import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { CortexAPI } from './api.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

let requestId = 0;
const pendingRequests = new Map<number, (result: any) => void>();

function sendNotification(method: string, params: any) {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

function sendRequest(method: string, params: any): Promise<any> {
    const id = requestId++;
    const promise = new Promise((resolve) => {
        pendingRequests.set(id, resolve);
    });
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return promise;
}

rl.on('line', (line) => {
    try {
        const message = JSON.parse(line);
        if (message.id !== undefined && message.result !== undefined) {
            // Response
            const resolve = pendingRequests.get(message.id);
            if (resolve) {
                resolve(message.result);
                pendingRequests.delete(message.id);
            }
        } else if (message.method) {
            // Request or Notification
            handleRequest(message);
        }
    } catch (e) {
        // Ignore invalid JSON
    }
});

async function handleRequest(message: any) {
    const { method, params, id } = message;
    try {
        switch (method) {
            case 'loadExtensions':
                const extensions = await loadExtensions(params.extensions);
                if (id !== undefined) {
                    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: extensions }) + '\n');
                }
                break;
            case 'executeCommand':
                const result = await executeExtensionCommand(params.command, params.args);
                if (id !== undefined) {
                    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
                }
                break;
            default:
                if (id !== undefined) {
                    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }) + '\n');
                }
        }
    } catch (e: any) {
        if (id !== undefined) {
            process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message: e.message } }) + '\n');
        }
    }
}

const commands = new Map<string, (...args: any[]) => any>();

const cortex: CortexAPI = {
    commands: {
        registerCommand(command, callback) {
            commands.set(command as string, callback);
            sendNotification('registerCommand', { command });
            return {
                dispose: () => {
                    commands.delete(command as string);
                    sendNotification('unregisterCommand', { command });
                }
            };
        },
        executeCommand(command, ...args) {
            return sendRequest('executeCommand', { command, args });
        }
    },
    window: {
        showInformationMessage(message) {
            return sendRequest('showInformationMessage', { message });
        },
        showErrorMessage(message) {
            return sendRequest('showErrorMessage', { message });
        }
    },
    workspace: {
        rootPath: process.cwd()
    }
};

async function loadExtensions(extensionPaths: string[]) {
    const loaded = [];
    for (const extPath of extensionPaths) {
        try {
            const manifestPath = path.join(extPath, 'extension.json');
            if (!fs.existsSync(manifestPath)) continue;
            
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (manifest.main) {
                const entryPoint = path.join(extPath, manifest.main);
                // Convert path to file URL for ESM import on Windows
                const entryPointUrl = `file://${entryPoint.replace(/\\/g, '/')}`;
                const extension = await import(entryPointUrl);
                if (extension.activate) {
                    await extension.activate(cortex);
                }
                loaded.push(manifest.name);
            }
        } catch (e: any) {
            console.error(`Failed to load extension at ${extPath}: ${e.message}`);
        }
    }
    return loaded;
}

async function executeExtensionCommand(command: string, args: any[]) {
    const callback = commands.get(command);
    if (callback) {
        return await callback(...args);
    }
    throw new Error(`Command ${command} not found`);
}

sendNotification('ready', {});
