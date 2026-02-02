export interface CortexAPI {
    commands: {
        registerCommand(command: String, callback: (...args: any[]) => any): Disposable;
        executeCommand<T = any>(command: string, ...args: any[]): Promise<T>;
    };
    window: {
        showInformationMessage(message: string): Promise<string | undefined>;
        showErrorMessage(message: string): Promise<string | undefined>;
    };
    workspace: {
        rootPath: string | undefined;
    };
}

export interface Disposable {
    dispose(): void;
}

export class EventEmitter<T> {
    private listeners: ((event: T) => any)[] = [];

    event = (listener: (event: T) => any) => {
        this.listeners.push(listener);
        return {
            dispose: () => {
                this.listeners = this.listeners.filter(l => l !== listener);
            }
        };
    };

    fire(event: T) {
        for (const listener of this.listeners) {
            listener(event);
        }
    }
}
