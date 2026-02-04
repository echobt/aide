/**
 * Web Extension Host - Runs browser-compatible extensions
 *
 * Web extensions:
 * - Run in browser context (no Node.js)
 * - Limited API surface
 * - Can be loaded from URLs
 * - Execute in isolated iframes for security
 */

import {
  Disposable,
  DisposableStore,
  EventEmitter,
  Event,
  createDisposable,
  ExtensionDescription,
  ExtensionStatus,
  ExtensionRuntimeState,
  ExtensionActivatedPayload,
  ExtensionErrorPayload,
  LogLevel,
} from "./types";

// Note: WebExtensionKind is used in multiple places including type definitions

// ============================================================================
// Web Extension Types
// ============================================================================

/**
 * Extension kind for web extensions
 */
export enum WebExtensionKind {
  UI = "ui",
  Workspace = "workspace",
  Web = "web",
}

/**
 * Web extension manifest extends the standard manifest with browser-specific fields
 */
export interface WebExtensionManifest {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Version string */
  version: string;
  /** Browser entry point (JavaScript file URL or path) */
  browser: string;
  /** Extension kinds this extension supports */
  extensionKind: WebExtensionKind[];
  /** Activation events */
  activationEvents?: string[];
  /** Dependencies on other extensions */
  dependencies?: string[];
  /** Whether the extension can run in a web environment */
  webCapable?: boolean;
  /** Extension capabilities */
  capabilities?: {
    /** Whether this extension requires untrusted workspace support */
    untrustedWorkspaces?: boolean;
    /** Whether this extension supports virtual workspaces */
    virtualWorkspaces?: boolean;
  };
}

/**
 * Web extension description for the host
 */
export interface WebExtensionDescription extends ExtensionDescription {
  /** Browser entry point */
  browser: string;
  /** Web extension kinds */
  webExtensionKind: WebExtensionKind[];
  /** Source URL if loaded from remote */
  sourceUrl?: string;
  /** Whether loaded from a trusted source */
  trusted: boolean;
}

/**
 * Limited API available to web extensions
 */
export interface WebExtensionAPI {
  /** Commands API (limited) */
  commands: {
    registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => Disposable;
    executeCommand: <T = unknown>(id: string, ...args: unknown[]) => Promise<T>;
    getCommands: () => Promise<string[]>;
  };
  /** Window API (limited, no file dialogs) */
  window: {
    showInformationMessage: (message: string, ...items: string[]) => Promise<string | undefined>;
    showWarningMessage: (message: string, ...items: string[]) => Promise<string | undefined>;
    showErrorMessage: (message: string, ...items: string[]) => Promise<string | undefined>;
    showQuickPick: (items: string[], options?: { placeHolder?: string }) => Promise<string | undefined>;
    showInputBox: (options?: { prompt?: string; value?: string }) => Promise<string | undefined>;
    setStatusBarMessage: (text: string, hideAfterTimeout?: number) => Disposable;
  };
  /** Workspace API (read-only, no file system access) */
  workspace: {
    getConfiguration: (section?: string) => {
      get: <T>(key: string, defaultValue?: T) => T | undefined;
      has: (key: string) => boolean;
    };
    onDidChangeConfiguration: Event<{ affectsConfiguration: (section: string) => boolean }>;
  };
  /** Extension context */
  context: {
    extensionUri: string;
    extensionPath: string;
    globalState: {
      get: <T>(key: string, defaultValue?: T) => T | undefined;
      update: (key: string, value: unknown) => Promise<void>;
    };
    workspaceState: {
      get: <T>(key: string, defaultValue?: T) => T | undefined;
      update: (key: string, value: unknown) => Promise<void>;
    };
  };
}

/**
 * Message types for iframe communication
 */
export enum WebExtensionMessageType {
  Initialize = "initialize",
  Ready = "ready",
  ApiCall = "apiCall",
  ApiResponse = "apiResponse",
  Event = "event",
  Activate = "activate",
  Deactivate = "deactivate",
  Activated = "activated",
  Deactivated = "deactivated",
  Error = "error",
  Log = "log",
}

/**
 * Message structure for iframe communication
 */
export interface WebExtensionMessage {
  type: WebExtensionMessageType;
  extensionId: string;
  requestId?: string;
  payload?: unknown;
}

// ============================================================================
// Web Extension Sandbox
// ============================================================================

/**
 * Isolated sandbox for running a web extension in an iframe
 */
export class WebExtensionSandbox implements Disposable {
  private iframe: HTMLIFrameElement | null = null;
  private readonly disposables = new DisposableStore();
  private readonly pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private activated = false;

  private readonly _onActivated = new EventEmitter<ExtensionActivatedPayload>();
  private readonly _onDeactivated = new EventEmitter<string>();
  private readonly _onError = new EventEmitter<ExtensionErrorPayload>();
  private readonly _onLog = new EventEmitter<{ level: LogLevel; message: string }>();

  readonly onActivated: Event<ExtensionActivatedPayload> = this._onActivated.event;
  readonly onDeactivated: Event<string> = this._onDeactivated.event;
  readonly onError: Event<ExtensionErrorPayload> = this._onError.event;
  readonly onLog: Event<{ level: LogLevel; message: string }> = this._onLog.event;

  constructor(
    private readonly extension: WebExtensionDescription,
    private readonly apiHandlers: Map<string, (...args: unknown[]) => Promise<unknown>>
  ) {
    this.disposables.add(this._onActivated);
    this.disposables.add(this._onDeactivated);
    this.disposables.add(this._onError);
    this.disposables.add(this._onLog);
  }

  /**
   * Get extension ID
   */
  get extensionId(): string {
    return this.extension.id;
  }

  /**
   * Check if extension is activated
   */
  get isActivated(): boolean {
    return this.activated;
  }

  /**
   * Create and initialize the sandbox iframe
   */
  async create(): Promise<void> {
    // Create hidden iframe
    this.iframe = document.createElement("iframe");
    this.iframe.style.display = "none";
    this.iframe.sandbox.add("allow-scripts");
    // Note: We don't add allow-same-origin to prevent access to parent storage/cookies

    // Generate sandbox HTML content
    const sandboxHtml = this.generateSandboxHtml();
    this.iframe.srcdoc = sandboxHtml;

    // Listen for messages from iframe
    const messageHandler = (event: MessageEvent<WebExtensionMessage>) => {
      if (event.source === this.iframe?.contentWindow) {
        this.handleMessage(event.data);
      }
    };

    window.addEventListener("message", messageHandler);
    this.disposables.add(createDisposable(() => {
      window.removeEventListener("message", messageHandler);
    }));

    // Append to document
    document.body.appendChild(this.iframe);
    this.disposables.add(createDisposable(() => {
      this.iframe?.remove();
      this.iframe = null;
    }));

    // Wait for ready signal
    await this.waitForReady();
  }

  /**
   * Activate the extension
   */
  async activate(): Promise<void> {
    if (!this.iframe?.contentWindow) {
      throw new Error("Sandbox not initialized");
    }

    this.postMessage({
      type: WebExtensionMessageType.Activate,
      extensionId: this.extension.id,
    });

    // Wait for activation confirmation
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Activation timeout"));
      }, 30000);

      const handler = this.onActivated((payload) => {
        if (payload.extensionId === this.extension.id) {
          clearTimeout(timeout);
          handler.dispose();
          resolve();
        }
      });

      const errorHandler = this.onError((payload) => {
        if (payload.extensionId === this.extension.id && payload.phase === "activation") {
          clearTimeout(timeout);
          handler.dispose();
          errorHandler.dispose();
          reject(new Error(payload.error));
        }
      });
    });

    this.activated = true;
  }

  /**
   * Deactivate the extension
   */
  async deactivate(): Promise<void> {
    if (!this.iframe?.contentWindow || !this.activated) {
      return;
    }

    this.postMessage({
      type: WebExtensionMessageType.Deactivate,
      extensionId: this.extension.id,
    });

    // Wait for deactivation confirmation (with timeout)
    await Promise.race([
      new Promise<void>((resolve) => {
        const handler = this.onDeactivated((extensionId) => {
          if (extensionId === this.extension.id) {
            handler.dispose();
            resolve();
          }
        });
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);

    this.activated = false;
  }

  /**
   * Send an event to the extension
   */
  sendEvent(eventName: string, data: unknown): void {
    if (!this.iframe?.contentWindow || !this.activated) {
      return;
    }

    this.postMessage({
      type: WebExtensionMessageType.Event,
      extensionId: this.extension.id,
      payload: { eventName, data },
    });
  }

  /**
   * Execute a command in the extension
   */
  async executeCommand<T = unknown>(commandId: string, ...args: unknown[]): Promise<T> {
    const requestId = this.generateRequestId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Command execution timeout: ${commandId}`));
      }, 30000);

      this.pendingRequests.set(requestId, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.postMessage({
        type: WebExtensionMessageType.ApiCall,
        extensionId: this.extension.id,
        requestId,
        payload: {
          namespace: "commands",
          method: "execute",
          args: [commandId, ...args],
        },
      });
    });
  }

  dispose(): void {
    this.disposables.dispose();
    this.pendingRequests.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate the sandbox HTML content
   */
  private generateSandboxHtml(): string {
    // Create a minimal sandbox environment with the web extension API
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ${this.extension.sourceUrl || this.extension.browser}">
</head>
<body>
<script>
(function() {
  const extensionId = ${JSON.stringify(this.extension.id)};
  const extensionPath = ${JSON.stringify(this.extension.path)};
  const browserEntry = ${JSON.stringify(this.extension.browser)};

  // Pending API requests
  const pendingRequests = new Map();
  let requestIdCounter = 0;

  // Registered commands
  const commands = new Map();

  // Event listeners
  const eventListeners = new Map();

  // Storage
  const globalState = new Map();
  const workspaceState = new Map();

  // Generate request ID
  function generateRequestId() {
    return 'web_' + Date.now() + '_' + (++requestIdCounter);
  }

  // Send message to parent
  function postMessage(message) {
    parent.postMessage({ ...message, extensionId }, '*');
  }

  // Call API on parent
  function callApi(namespace, method, ...args) {
    return new Promise((resolve, reject) => {
      const requestId = generateRequestId();
      pendingRequests.set(requestId, { resolve, reject });

      postMessage({
        type: 'apiCall',
        requestId,
        payload: { namespace, method, args }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error('API call timeout'));
        }
      }, 30000);
    });
  }

  // Create disposable
  function createDisposable(fn) {
    let disposed = false;
    return {
      dispose() {
        if (!disposed) {
          disposed = true;
          fn();
        }
      }
    };
  }

  // Create event emitter
  function createEventEmitter() {
    const listeners = new Set();
    return {
      event(listener) {
        listeners.add(listener);
        return createDisposable(() => listeners.delete(listener));
      },
      fire(data) {
        listeners.forEach(l => {
          try { l(data); } catch (e) { console.error(e); }
        });
      }
    };
  }

  // Configuration change emitter
  const configChangeEmitter = createEventEmitter();

  // Create limited API for web extensions
  const orion = {
    commands: {
      registerCommand(id, handler) {
        const fullId = extensionId + '.' + id;
        commands.set(fullId, handler);
        callApi('commands', 'register', fullId);
        return createDisposable(() => {
          commands.delete(fullId);
          callApi('commands', 'unregister', fullId);
        });
      },
      async executeCommand(id, ...args) {
        // Check local commands first
        if (commands.has(id)) {
          return commands.get(id)(...args);
        }
        return callApi('commands', 'execute', id, ...args);
      },
      async getCommands() {
        return callApi('commands', 'getAll');
      }
    },
    window: {
      async showInformationMessage(message, ...items) {
        return callApi('window', 'showInformationMessage', message, items);
      },
      async showWarningMessage(message, ...items) {
        return callApi('window', 'showWarningMessage', message, items);
      },
      async showErrorMessage(message, ...items) {
        return callApi('window', 'showErrorMessage', message, items);
      },
      async showQuickPick(items, options) {
        return callApi('window', 'showQuickPick', items, options);
      },
      async showInputBox(options) {
        return callApi('window', 'showInputBox', options);
      },
      setStatusBarMessage(text, hideAfterTimeout) {
        const id = generateRequestId();
        callApi('window', 'setStatusBarMessage', id, text, hideAfterTimeout);
        return createDisposable(() => {
          callApi('window', 'clearStatusBarMessage', id);
        });
      }
    },
    workspace: {
      getConfiguration(section) {
        return {
          get(key, defaultValue) {
            // Synchronous - return cached value
            // Web extensions have limited config access
            return defaultValue;
          },
          has(key) {
            return false;
          }
        };
      },
      onDidChangeConfiguration: configChangeEmitter.event
    },
    context: {
      extensionUri: extensionPath,
      extensionPath: extensionPath,
      globalState: {
        get(key, defaultValue) {
          return globalState.has(key) ? globalState.get(key) : defaultValue;
        },
        async update(key, value) {
          globalState.set(key, value);
          await callApi('storage', 'updateGlobal', key, value);
        }
      },
      workspaceState: {
        get(key, defaultValue) {
          return workspaceState.has(key) ? workspaceState.get(key) : defaultValue;
        },
        async update(key, value) {
          workspaceState.set(key, value);
          await callApi('storage', 'updateWorkspace', key, value);
        }
      }
    }
  };

  // Extension module
  let extensionModule = null;
  let exports = {};

  // Handle messages from parent
  window.addEventListener('message', async (event) => {
    const message = event.data;
    if (!message || message.extensionId !== extensionId) return;

    switch (message.type) {
      case 'apiResponse': {
        const pending = pendingRequests.get(message.requestId);
        if (pending) {
          pendingRequests.delete(message.requestId);
          if (message.payload.error) {
            pending.reject(new Error(message.payload.error.message));
          } else {
            pending.resolve(message.payload.result);
          }
        }
        break;
      }

      case 'activate': {
        const startTime = Date.now();
        try {
          // Load extension module
          const script = document.createElement('script');
          script.type = 'module';
          script.textContent = \`
            import * as ext from '\${browserEntry}';
            window.__extensionModule = ext;
          \`;
          document.head.appendChild(script);

          // Wait for module to load
          await new Promise((resolve, reject) => {
            const check = setInterval(() => {
              if (window.__extensionModule) {
                clearInterval(check);
                resolve();
              }
            }, 10);
            setTimeout(() => {
              clearInterval(check);
              reject(new Error('Module load timeout'));
            }, 10000);
          });

          extensionModule = window.__extensionModule;

          // Call activate if present
          if (typeof extensionModule.activate === 'function') {
            exports = await extensionModule.activate(orion.context) || {};
          }

          const activationTime = Date.now() - startTime;
          postMessage({
            type: 'activated',
            payload: { extensionId, activationTime, exports }
          });
        } catch (error) {
          postMessage({
            type: 'error',
            payload: {
              extensionId,
              error: error.message,
              stack: error.stack,
              phase: 'activation'
            }
          });
        }
        break;
      }

      case 'deactivate': {
        try {
          if (extensionModule && typeof extensionModule.deactivate === 'function') {
            await extensionModule.deactivate();
          }
          postMessage({ type: 'deactivated', payload: { extensionId } });
        } catch (error) {
          postMessage({
            type: 'error',
            payload: {
              extensionId,
              error: error.message,
              stack: error.stack,
              phase: 'deactivation'
            }
          });
        }
        break;
      }

      case 'event': {
        const { eventName, data } = message.payload;
        const listeners = eventListeners.get(eventName);
        if (listeners) {
          listeners.forEach(l => {
            try { l(data); } catch (e) { console.error(e); }
          });
        }
        if (eventName === 'configurationChanged') {
          configChangeEmitter.fire(data);
        }
        break;
      }

      case 'apiCall': {
        // Handle API calls from parent (e.g., command execution)
        const { namespace, method, args } = message.payload;
        try {
          let result;
          if (namespace === 'commands' && method === 'execute') {
            const [commandId, ...cmdArgs] = args;
            const handler = commands.get(commandId);
            if (handler) {
              result = await handler(...cmdArgs);
            }
          }
          postMessage({
            type: 'apiResponse',
            requestId: message.requestId,
            payload: { result }
          });
        } catch (error) {
          postMessage({
            type: 'apiResponse',
            requestId: message.requestId,
            payload: { error: { message: error.message } }
          });
        }
        break;
      }
    }
  });

  // Signal ready
  postMessage({ type: 'ready' });
})();
</script>
</body>
</html>
    `;
  }

  /**
   * Wait for the sandbox to be ready
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Sandbox initialization timeout"));
      }, 10000);

      const handler = (event: MessageEvent<WebExtensionMessage>) => {
        if (
          event.source === this.iframe?.contentWindow &&
          event.data.type === WebExtensionMessageType.Ready &&
          event.data.extensionId === this.extension.id
        ) {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve();
        }
      };

      window.addEventListener("message", handler);
    });
  }

  /**
   * Handle messages from the iframe
   */
  private handleMessage(message: WebExtensionMessage): void {
    switch (message.type) {
      case WebExtensionMessageType.Activated:
        this._onActivated.fire(message.payload as ExtensionActivatedPayload);
        break;

      case WebExtensionMessageType.Deactivated:
        this._onDeactivated.fire(message.extensionId);
        break;

      case WebExtensionMessageType.Error:
        this._onError.fire(message.payload as ExtensionErrorPayload);
        break;

      case WebExtensionMessageType.Log:
        this._onLog.fire(message.payload as { level: LogLevel; message: string });
        break;

      case WebExtensionMessageType.ApiCall:
        this.handleApiCall(message);
        break;

      case WebExtensionMessageType.ApiResponse:
        this.handleApiResponse(message);
        break;
    }
  }

  /**
   * Handle API calls from the iframe
   */
  private async handleApiCall(message: WebExtensionMessage): Promise<void> {
    const { namespace, method, args } = message.payload as {
      namespace: string;
      method: string;
      args: unknown[];
    };

    try {
      const handlerKey = `${namespace}.${method}`;
      const handler = this.apiHandlers.get(handlerKey);

      let result: unknown;
      if (handler) {
        result = await handler(...args);
      } else {
        throw new Error(`Unknown API: ${handlerKey}`);
      }

      this.postMessage({
        type: WebExtensionMessageType.ApiResponse,
        extensionId: this.extension.id,
        requestId: message.requestId,
        payload: { result },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.postMessage({
        type: WebExtensionMessageType.ApiResponse,
        extensionId: this.extension.id,
        requestId: message.requestId,
        payload: { error: { message: err.message } },
      });
    }
  }

  /**
   * Handle API responses from the iframe
   */
  private handleApiResponse(message: WebExtensionMessage): void {
    const pending = this.pendingRequests.get(message.requestId!);
    if (!pending) return;

    this.pendingRequests.delete(message.requestId!);
    const payload = message.payload as { result?: unknown; error?: { message: string } };

    if (payload.error) {
      pending.reject(new Error(payload.error.message));
    } else {
      pending.resolve(payload.result);
    }
  }

  /**
   * Post a message to the iframe
   */
  private postMessage(message: WebExtensionMessage): void {
    this.iframe?.contentWindow?.postMessage(message, "*");
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `sandbox_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

// ============================================================================
// Web Extension Host
// ============================================================================

/**
 * Configuration for the web extension host
 */
export interface WebExtensionHostConfig {
  /** Web extensions to load */
  extensions: WebExtensionDescription[];
  /** Log level */
  logLevel: LogLevel;
}

/**
 * Web Extension Host - manages web-compatible extensions
 */
export class WebExtensionHost implements Disposable {
  private readonly disposables = new DisposableStore();
  private readonly sandboxes = new Map<string, WebExtensionSandbox>();
  private readonly apiHandlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  private readonly commandHandlers = new Map<string, (...args: unknown[]) => unknown>();
  private readonly states = new Map<string, ExtensionRuntimeState>();

  private readonly _onExtensionActivated = new EventEmitter<ExtensionActivatedPayload>();
  private readonly _onExtensionDeactivated = new EventEmitter<string>();
  private readonly _onExtensionError = new EventEmitter<ExtensionErrorPayload>();
  private readonly _onLog = new EventEmitter<{ extensionId: string; level: LogLevel; message: string }>();

  readonly onExtensionActivated: Event<ExtensionActivatedPayload> = this._onExtensionActivated.event;
  readonly onExtensionDeactivated: Event<string> = this._onExtensionDeactivated.event;
  readonly onExtensionError: Event<ExtensionErrorPayload> = this._onExtensionError.event;
  readonly onLog: Event<{ extensionId: string; level: LogLevel; message: string }> = this._onLog.event;

  constructor(private readonly config: WebExtensionHostConfig) {
    this.disposables.add(this._onExtensionActivated);
    this.disposables.add(this._onExtensionDeactivated);
    this.disposables.add(this._onExtensionError);
    this.disposables.add(this._onLog);

    this.registerDefaultApiHandlers();
  }

  /**
   * Start the web extension host and load extensions
   */
  async start(): Promise<void> {
    for (const extension of this.config.extensions) {
      await this.loadExtension(extension);
    }
  }

  /**
   * Stop all extensions
   */
  async stop(): Promise<void> {
    const deactivations = Array.from(this.sandboxes.values()).map((sandbox) =>
      sandbox.deactivate().catch((e) => {
        console.error(`Failed to deactivate ${sandbox.extensionId}:`, e);
      })
    );

    await Promise.all(deactivations);
  }

  /**
   * Load and activate a web extension
   */
  async loadExtension(extension: WebExtensionDescription): Promise<void> {
    // Initialize state
    this.states.set(extension.id, {
      id: extension.id,
      status: ExtensionStatus.Inactive,
    });

    try {
      // Create sandbox
      const sandbox = new WebExtensionSandbox(extension, this.apiHandlers);
      this.sandboxes.set(extension.id, sandbox);

      // Set up event handlers
      sandbox.onActivated((payload) => {
        this.states.set(extension.id, {
          id: extension.id,
          status: ExtensionStatus.Active,
          activationTime: payload.activationTime,
          lastActivity: Date.now(),
        });
        this._onExtensionActivated.fire(payload);
      });

      sandbox.onDeactivated((extensionId) => {
        const state = this.states.get(extensionId);
        if (state) {
          state.status = ExtensionStatus.Inactive;
        }
        this._onExtensionDeactivated.fire(extensionId);
      });

      sandbox.onError((payload) => {
        const state = this.states.get(payload.extensionId);
        if (state) {
          state.status = ExtensionStatus.Error;
          state.error = payload.error;
        }
        this._onExtensionError.fire(payload);
      });

      sandbox.onLog((payload) => {
        this._onLog.fire({
          extensionId: extension.id,
          ...payload,
        });
      });

      this.disposables.add(sandbox);

      // Update state to activating
      this.states.set(extension.id, {
        id: extension.id,
        status: ExtensionStatus.Activating,
      });

      // Create and activate sandbox
      await sandbox.create();
      await sandbox.activate();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.states.set(extension.id, {
        id: extension.id,
        status: ExtensionStatus.Error,
        error: err.message,
      });

      this._onExtensionError.fire({
        extensionId: extension.id,
        error: err.message,
        stack: err.stack,
        phase: "activation",
      });
    }
  }

  /**
   * Unload a web extension
   */
  async unloadExtension(extensionId: string): Promise<void> {
    const sandbox = this.sandboxes.get(extensionId);
    if (sandbox) {
      await sandbox.deactivate();
      sandbox.dispose();
      this.sandboxes.delete(extensionId);
    }
    this.states.delete(extensionId);
  }

  /**
   * Get extension state
   */
  getExtensionState(extensionId: string): ExtensionRuntimeState | undefined {
    return this.states.get(extensionId);
  }

  /**
   * Get all extension states
   */
  getAllExtensionStates(): ExtensionRuntimeState[] {
    return Array.from(this.states.values());
  }

  /**
   * Send an event to all active web extensions
   */
  sendEvent(eventName: string, data: unknown): void {
    for (const sandbox of this.sandboxes.values()) {
      if (sandbox.isActivated) {
        sandbox.sendEvent(eventName, data);
      }
    }
  }

  /**
   * Execute a command
   */
  async executeCommand<T = unknown>(commandId: string, ...args: unknown[]): Promise<T> {
    // Check local handlers first
    const handler = this.commandHandlers.get(commandId);
    if (handler) {
      return handler(...args) as T;
    }

    // Try each sandbox
    for (const sandbox of this.sandboxes.values()) {
      if (sandbox.isActivated) {
        try {
          return await sandbox.executeCommand<T>(commandId, ...args);
        } catch {
          // Continue to next sandbox
        }
      }
    }

    throw new Error(`Command not found: ${commandId}`);
  }

  /**
   * Register a command handler
   */
  registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable {
    this.commandHandlers.set(id, handler);
    return createDisposable(() => {
      this.commandHandlers.delete(id);
    });
  }

  dispose(): void {
    this.disposables.dispose();
    this.sandboxes.clear();
    this.states.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Register default API handlers for web extensions
   */
  private registerDefaultApiHandlers(): void {
    // Commands
    this.apiHandlers.set("commands.register", async (commandId: unknown) => {
      // Track registered command
      console.debug(`[WebExtensionHost] Command registered: ${commandId}`);
    });

    this.apiHandlers.set("commands.unregister", async (commandId: unknown) => {
      console.debug(`[WebExtensionHost] Command unregistered: ${commandId}`);
    });

    this.apiHandlers.set("commands.execute", async (commandId: unknown, ...args: unknown[]) => {
      return this.executeCommand(commandId as string, ...args);
    });

    this.apiHandlers.set("commands.getAll", async () => {
      return Array.from(this.commandHandlers.keys());
    });

    // Window
    this.apiHandlers.set("window.showInformationMessage", async (message: unknown, _items: unknown) => {
      console.info(`[WebExtension] Info: ${message}`);
      return undefined;
    });

    this.apiHandlers.set("window.showWarningMessage", async (message: unknown, _items: unknown) => {
      console.warn(`[WebExtension] Warning: ${message}`);
      return undefined;
    });

    this.apiHandlers.set("window.showErrorMessage", async (message: unknown, _items: unknown) => {
      console.error(`[WebExtension] Error: ${message}`);
      return undefined;
    });

    this.apiHandlers.set("window.showQuickPick", async (_items: unknown, _options: unknown) => {
      // Would integrate with UI
      return undefined;
    });

    this.apiHandlers.set("window.showInputBox", async (_options: unknown) => {
      // Would integrate with UI
      return undefined;
    });

    this.apiHandlers.set("window.setStatusBarMessage", async (_id: unknown, _text: unknown, _timeout: unknown) => {
      // Would integrate with status bar
    });

    this.apiHandlers.set("window.clearStatusBarMessage", async (_id: unknown) => {
      // Would clear status bar message
    });

    // Storage
    this.apiHandlers.set("storage.updateGlobal", async (_key: unknown, _value: unknown) => {
      // Would persist to storage
    });

    this.apiHandlers.set("storage.updateWorkspace", async (_key: unknown, _value: unknown) => {
      // Would persist to storage
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an extension is a web-only extension
 */
export function isWebExtension(extension: ExtensionDescription | WebExtensionDescription): boolean {
  // Check if it has web extension kind
  if ("webExtensionKind" in extension) {
    return extension.webExtensionKind.includes(WebExtensionKind.Web);
  }

  // Check standard extension kind (2 = Workspace, 1 = UI)
  // Web-only extensions typically don't have Workspace kind
  return extension.extensionKind.length === 0 || 
    !extension.extensionKind.some((k) => k === 2);
}

/**
 * Check if an extension can run in web context
 */
export function canRunInWebContext(extension: WebExtensionDescription): boolean {
  // Must have a browser entry point
  if (!extension.browser) {
    return false;
  }

  // Must include web extension kind
  return extension.webExtensionKind.some(
    (k) => k === WebExtensionKind.Web || k === WebExtensionKind.UI
  );
}

/**
 * Get the extension kind as string array
 */
export function getExtensionKindStrings(
  extension: ExtensionDescription | WebExtensionDescription
): string[] {
  if ("webExtensionKind" in extension) {
    return extension.webExtensionKind;
  }

  return extension.extensionKind.map((k) => {
    switch (k) {
      case 1:
        return WebExtensionKind.UI;
      case 2:
        return WebExtensionKind.Workspace;
      default:
        return WebExtensionKind.Workspace;
    }
  });
}

/**
 * Convert a standard extension description to web extension description
 */
export function toWebExtensionDescription(
  extension: ExtensionDescription,
  browserEntry: string,
  options?: {
    sourceUrl?: string;
    trusted?: boolean;
  }
): WebExtensionDescription {
  return {
    ...extension,
    browser: browserEntry,
    webExtensionKind: extension.extensionKind.map((k) => {
      switch (k) {
        case 1:
          return WebExtensionKind.UI;
        case 2:
          return WebExtensionKind.Workspace;
        default:
          return WebExtensionKind.Workspace;
      }
    }),
    sourceUrl: options?.sourceUrl,
    trusted: options?.trusted ?? false,
  };
}

/**
 * Create a web extension host
 */
export async function createWebExtensionHost(
  config: WebExtensionHostConfig
): Promise<WebExtensionHost> {
  const host = new WebExtensionHost(config);
  await host.start();
  return host;
}
