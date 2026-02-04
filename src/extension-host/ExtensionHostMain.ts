/**
 * Extension Host Main Thread Coordinator
 *
 * Manages the extension host worker from the main thread.
 * Handles communication, API bridging, and lifecycle management.
 */

import {
  Disposable,
  DisposableStore,
  EventEmitter,
  createDisposable,
  Event,
  ExtensionHostMessage,
  ExtensionHostMessageType,
  InitializePayload,
  ApiRequestPayload,
  ApiResponsePayload,
  ExtensionActivatedPayload,
  ExtensionErrorPayload,
  EventPayload,
  ExtensionDescription,
  ExtensionStatus,
  ExtensionRuntimeState,
  PendingRequest,
  ResourceLimits,
  WorkspaceFolder,
  LogLevel,
} from "./types";

// ============================================================================
// Extension Host Configuration
// ============================================================================

export interface ExtensionHostConfig {
  /** Path to the worker script */
  workerPath: string;

  /** Workspace folders to initialize with */
  workspaceFolders: WorkspaceFolder[];

  /** Initial configuration */
  configuration: Record<string, unknown>;

  /** Extensions to load */
  extensions: ExtensionDescription[];

  /** Log level */
  logLevel: LogLevel;

  /** Resource limits */
  resourceLimits: ResourceLimits;

  /** API request timeout in ms */
  requestTimeout: number;

  /** Maximum restart attempts */
  maxRestarts: number;

  /** Restart delay in ms */
  restartDelay: number;
}

const DEFAULT_CONFIG: Partial<ExtensionHostConfig> = {
  logLevel: LogLevel.Info,
  resourceLimits: {
    maxMemoryMB: 512,
    cpuThrottlePercent: 100,
    maxExecutionTimeMs: 30000,
  },
  requestTimeout: 30000,
  maxRestarts: 3,
  restartDelay: 1000,
};

// ============================================================================
// Extension Host State
// ============================================================================

export enum ExtensionHostStatus {
  Stopped = "stopped",
  Starting = "starting",
  Ready = "ready",
  Crashed = "crashed",
  ShuttingDown = "shuttingDown",
}

export interface ExtensionHostState {
  status: ExtensionHostStatus;
  extensions: Map<string, ExtensionRuntimeState>;
  restartCount: number;
  lastError?: string;
  startTime?: number;
  readyTime?: number;
}

// ============================================================================
// API Handler Registry
// ============================================================================

export type ApiHandler = (
  extensionId: string,
  method: string,
  args: unknown[]
) => Promise<unknown>;

export interface ApiNamespaceHandlers {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [method: string]: (extensionId: string, ...args: any[]) => Promise<any>;
}

// ============================================================================
// Extension Host Main
// ============================================================================

export class ExtensionHostMain implements Disposable {
  private readonly config: ExtensionHostConfig;
  private readonly disposables = new DisposableStore();
  private readonly apiHandlers = new Map<string, ApiNamespaceHandlers>();
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly commandHandlers = new Map<string, (...args: unknown[]) => unknown>();

  private worker: Worker | null = null;
  private state: ExtensionHostState = {
    status: ExtensionHostStatus.Stopped,
    extensions: new Map(),
    restartCount: 0,
  };

  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;

  // Events
  private readonly _onDidStart = new EventEmitter<void>();
  private readonly _onDidStop = new EventEmitter<void>();
  private readonly _onDidCrash = new EventEmitter<Error>();
  private readonly _onDidRestart = new EventEmitter<number>();
  private readonly _onExtensionActivated = new EventEmitter<ExtensionActivatedPayload>();
  private readonly _onExtensionDeactivated = new EventEmitter<string>();
  private readonly _onExtensionError = new EventEmitter<ExtensionErrorPayload>();
  private readonly _onLog = new EventEmitter<{ extensionId: string; level: LogLevel; message: string }>();

  readonly onDidStart: Event<void> = this._onDidStart.event;
  readonly onDidStop: Event<void> = this._onDidStop.event;
  readonly onDidCrash: Event<Error> = this._onDidCrash.event;
  readonly onDidRestart: Event<number> = this._onDidRestart.event;
  readonly onExtensionActivated: Event<ExtensionActivatedPayload> = this._onExtensionActivated.event;
  readonly onExtensionDeactivated: Event<string> = this._onExtensionDeactivated.event;
  readonly onExtensionError: Event<ExtensionErrorPayload> = this._onExtensionError.event;
  readonly onLog: Event<{ extensionId: string; level: LogLevel; message: string }> = this._onLog.event;

  constructor(config: Partial<ExtensionHostConfig> & { workerPath: string; extensions: ExtensionDescription[] }) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      workspaceFolders: config.workspaceFolders ?? [],
      configuration: config.configuration ?? {},
    } as ExtensionHostConfig;

    this.disposables.add(this._onDidStart);
    this.disposables.add(this._onDidStop);
    this.disposables.add(this._onDidCrash);
    this.disposables.add(this._onDidRestart);
    this.disposables.add(this._onExtensionActivated);
    this.disposables.add(this._onExtensionDeactivated);
    this.disposables.add(this._onExtensionError);
    this.disposables.add(this._onLog);

    this.registerDefaultApiHandlers();
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Start the extension host worker.
   */
  async start(): Promise<void> {
    if (this.worker) {
      throw new Error("Extension host already started");
    }

    this.state = {
      status: ExtensionHostStatus.Starting,
      extensions: new Map(),
      restartCount: this.state.restartCount,
      startTime: Date.now(),
    };

    // Create ready promise
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    try {
      // Create worker
      this.worker = new Worker(this.config.workerPath, { type: "module" });

      // Set up message handler
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      // Send initialization message
      const initPayload: InitializePayload = {
        extensions: this.config.extensions,
        workspaceFolders: this.config.workspaceFolders,
        configuration: this.config.configuration,
        logLevel: this.config.logLevel,
        resourceLimits: this.config.resourceLimits,
        hostVersion: "1.0.0",
        platformInfo: {
          os: this.detectOS(),
          arch: "x64",
          isWeb: false,
        },
      };

      this.postMessage({
        type: ExtensionHostMessageType.Initialize,
        payload: initPayload,
      });

      // Wait for ready signal
      await this.readyPromise;

      this.state.status = ExtensionHostStatus.Ready;
      this.state.readyTime = Date.now();
      this._onDidStart.fire();
    } catch (error) {
      this.state.status = ExtensionHostStatus.Crashed;
      this.state.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Stop the extension host worker.
   */
  async stop(): Promise<void> {
    if (!this.worker) {
      return;
    }

    this.state.status = ExtensionHostStatus.ShuttingDown;

    // Create shutdown promise
    const shutdownPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Shutdown timeout"));
      }, 10000);

      const handler = (event: MessageEvent<ExtensionHostMessage>) => {
        if (event.data.type === ExtensionHostMessageType.ShutdownComplete) {
          clearTimeout(timeout);
          resolve();
        }
      };

      this.worker!.addEventListener("message", handler);
    });

    // Send shutdown message
    this.postMessage({
      type: ExtensionHostMessageType.Shutdown,
    });

    try {
      await shutdownPromise;
    } catch {
      // Force terminate on timeout
      console.warn("[ExtensionHost] Shutdown timeout, forcing termination");
    }

    this.terminateWorker();
    this.state.status = ExtensionHostStatus.Stopped;
    this._onDidStop.fire();
  }

  /**
   * Restart the extension host.
   */
  async restart(): Promise<void> {
    await this.stop();
    this.state.restartCount++;
    await new Promise((resolve) => setTimeout(resolve, this.config.restartDelay));
    this._onDidRestart.fire(this.state.restartCount);
    await this.start();
  }

  /**
   * Get current status.
   */
  getStatus(): ExtensionHostStatus {
    return this.state.status;
  }

  /**
   * Get extension runtime state.
   */
  getExtensionState(extensionId: string): ExtensionRuntimeState | undefined {
    return this.state.extensions.get(extensionId);
  }

  /**
   * Get all extension states.
   */
  getAllExtensionStates(): ExtensionRuntimeState[] {
    return Array.from(this.state.extensions.values());
  }

  /**
   * Check if host is ready.
   */
  isReady(): boolean {
    return this.state.status === ExtensionHostStatus.Ready;
  }

  /**
   * Wait for host to be ready.
   */
  async whenReady(): Promise<void> {
    if (this.isReady()) return;
    if (this.readyPromise) {
      await this.readyPromise;
    }
  }

  // ============================================================================
  // Extension Control
  // ============================================================================

  /**
   * Activate a specific extension.
   */
  async activateExtension(extensionId: string): Promise<void> {
    await this.whenReady();

    this.postMessage({
      type: ExtensionHostMessageType.ActivateExtension,
      payload: { extensionId },
    });
  }

  /**
   * Deactivate a specific extension.
   */
  async deactivateExtension(extensionId: string): Promise<void> {
    await this.whenReady();

    this.postMessage({
      type: ExtensionHostMessageType.DeactivateExtension,
      payload: { extensionId },
    });
  }

  /**
   * Execute a command.
   */
  async executeCommand<T = unknown>(commandId: string, ...args: unknown[]): Promise<T> {
    // Check local handlers first
    const handler = this.commandHandlers.get(commandId);
    if (handler) {
      return handler(...args) as T;
    }

    // Forward to worker
    await this.whenReady();

    return new Promise<T>((resolve, reject) => {
      const requestId = this.generateRequestId();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Command execution timeout: ${commandId}`));
      }, this.config.requestTimeout);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
        extensionId: "main",
        method: `command:${commandId}`,
        timestamp: Date.now(),
      });

      this.postMessage({
        type: ExtensionHostMessageType.ExecuteCommand,
        requestId,
        payload: { commandId, args },
      });
    });
  }

  /**
   * Send an event to extensions.
   */
  sendEvent(eventName: string, data: unknown): void {
    if (!this.isReady()) return;

    const payload: EventPayload = { eventName, data };
    this.postMessage({
      type: ExtensionHostMessageType.Event,
      payload,
    });
  }

  // ============================================================================
  // API Handlers
  // ============================================================================

  /**
   * Register API handlers for a namespace.
   */
  registerApiHandlers(namespace: string, handlers: ApiNamespaceHandlers): Disposable {
    this.apiHandlers.set(namespace, handlers);
    return createDisposable(() => {
      this.apiHandlers.delete(namespace);
    });
  }

  /**
   * Register a command handler.
   */
  registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable {
    this.commandHandlers.set(id, handler);
    return createDisposable(() => {
      this.commandHandlers.delete(id);
    });
  }

  /**
   * Register default API handlers.
   */
  private registerDefaultApiHandlers(): void {
    // Commands namespace
    this.registerApiHandlers("commands", {
      async register(extensionId: string, commandId: string) {
        // Extension registered a command - track it
        console.debug(`[ExtensionHost] Extension ${extensionId} registered command: ${commandId}`);
      },
      async unregister(extensionId: string, commandId: string) {
        console.debug(`[ExtensionHost] Extension ${extensionId} unregistered command: ${commandId}`);
      },
      async execute(_extensionId: string, commandId: string, ..._args: unknown[]) {
        // Would delegate to command palette / command registry
        console.debug(`[ExtensionHost] Execute command: ${commandId}`);
        return undefined;
      },
      async getAll(_extensionId: string, _filterInternal: boolean) {
        // Return registered commands
        return [];
      },
    });

    // Workspace namespace
    this.registerApiHandlers("workspace", {
      async openTextDocument(_extensionId: string, _uri: unknown) {
        // Would open document via editor context
        return null;
      },
      async findFiles(
        _extensionId: string,
        _include: string,
        _exclude?: string,
        _maxResults?: number
      ) {
        // Would use file system
        return [];
      },
      async saveAll(_extensionId: string, _includeUntitled: boolean) {
        return true;
      },
      async applyEdit(_extensionId: string, _entries: unknown) {
        return true;
      },
      async createFileSystemWatcher(
        _extensionId: string,
        _watcherId: string,
        _pattern: string,
        _options: unknown
      ) {
        // Would set up file watcher
      },
      async disposeFileSystemWatcher(_extensionId: string, _watcherId: string) {
        // Would dispose watcher
      },
      async updateConfiguration(
        _extensionId: string,
        _key: string,
        _value: unknown,
        _target: unknown
      ) {
        // Would update settings
      },
    });

    // Window namespace
    this.registerApiHandlers("window", {
      async showInformationMessage(
        extensionId: string,
        message: string,
        _options: unknown,
        _items: unknown
      ) {
        console.info(`[${extensionId}] Info: ${message}`);
        return undefined;
      },
      async showWarningMessage(
        extensionId: string,
        message: string,
        _options: unknown,
        _items: unknown
      ) {
        console.warn(`[${extensionId}] Warning: ${message}`);
        return undefined;
      },
      async showErrorMessage(
        extensionId: string,
        message: string,
        _options: unknown,
        _items: unknown
      ) {
        console.error(`[${extensionId}] Error: ${message}`);
        return undefined;
      },
      async showQuickPick(_extensionId: string, _items: unknown[], _options: unknown) {
        // Would show quick pick UI
        return undefined;
      },
      async showInputBox(_extensionId: string, _options: unknown) {
        // Would show input box UI
        return undefined;
      },
      async outputChannelAppend(
        _extensionId: string,
        _channelId: string,
        _name: string,
        _value: string,
        _languageId?: string
      ) {
        // Would append to output channel
      },
      async outputChannelClear(_extensionId: string, _channelId: string) {
        // Would clear output channel
      },
      async outputChannelShow(_extensionId: string, _channelId: string, _preserveFocus: boolean) {
        // Would show output channel
      },
      async outputChannelHide(_extensionId: string, _channelId: string) {
        // Would hide output channel
      },
      async outputChannelDispose(_extensionId: string, _channelId: string) {
        // Would dispose output channel
      },
      async startProgress(_extensionId: string, _progressId: string, _options: unknown) {
        // Would start progress indicator
      },
      async reportProgress(_extensionId: string, _progressId: string, _value: unknown) {
        // Would update progress
      },
      async endProgress(_extensionId: string, _progressId: string) {
        // Would end progress indicator
      },
      async setStatusBarMessage(
        _extensionId: string,
        _messageId: string,
        _text: string,
        _timeout?: number
      ) {
        // Would set status bar message
      },
      async clearStatusBarMessage(_extensionId: string, _messageId: string) {
        // Would clear status bar message
      },
      async getActiveTextEditor(_extensionId: string) {
        return undefined;
      },
      async showTextDocument(_extensionId: string, _uri: unknown, _options: unknown) {
        return undefined;
      },
    });

    // Languages namespace
    this.registerApiHandlers("languages", {
      async getLanguages(_extensionId: string) {
        return [];
      },
      async setTextDocumentLanguage(_extensionId: string, _uri: unknown, _languageId: string) {
        return null;
      },
      async registerCompletionProvider(
        _extensionId: string,
        _providerId: string,
        _selector: unknown,
        _triggerCharacters: string[]
      ) {
        // Would register with Monaco
      },
      async registerHoverProvider(
        _extensionId: string,
        _providerId: string,
        _selector: unknown
      ) {
        // Would register with Monaco
      },
      async registerDefinitionProvider(
        _extensionId: string,
        _providerId: string,
        _selector: unknown
      ) {
        // Would register with Monaco
      },
      async unregisterProvider(_extensionId: string, _providerId: string) {
        // Would unregister from Monaco
      },
      async completionResponse(
        _extensionId: string,
        _requestId: string,
        _result: unknown,
        _error?: string
      ) {
        // Would send completion response
      },
      async hoverResponse(
        _extensionId: string,
        _requestId: string,
        _result: unknown,
        _error?: string
      ) {
        // Would send hover response
      },
      async definitionResponse(
        _extensionId: string,
        _requestId: string,
        _result: unknown,
        _error?: string
      ) {
        // Would send definition response
      },
    });

    // Storage namespace
    this.registerApiHandlers("storage", {
      async update(_extensionId: string, _scope: string, _key: string, _value: unknown) {
        // Would persist to storage
      },
      async setKeysForSync(_extensionId: string, _keys: string[]) {
        // Would configure sync
      },
    });

    // Secrets namespace
    this.registerApiHandlers("secrets", {
      async get(_extensionId: string, _key: string) {
        // Would get from secure storage
        return undefined;
      },
      async store(_extensionId: string, _key: string, _value: string) {
        // Would store in secure storage
      },
      async delete(_extensionId: string, _key: string) {
        // Would delete from secure storage
      },
    });
  }

  // ============================================================================
  // Worker Communication
  // ============================================================================

  /**
   * Post a message to the worker.
   */
  private postMessage(message: ExtensionHostMessage): void {
    if (this.worker) {
      this.worker.postMessage(message);
    }
  }

  /**
   * Handle messages from the worker.
   */
  private handleWorkerMessage(event: MessageEvent<ExtensionHostMessage>): void {
    const message = event.data;

    switch (message.type) {
      case ExtensionHostMessageType.Ready:
        this.handleReady();
        break;

      case ExtensionHostMessageType.ApiRequest:
        this.handleApiRequest(message.requestId!, message.payload as ApiRequestPayload);
        break;

      case ExtensionHostMessageType.ExtensionActivated:
        this.handleExtensionActivated(message.payload as ExtensionActivatedPayload);
        break;

      case ExtensionHostMessageType.ExtensionDeactivated:
        this.handleExtensionDeactivated(message.payload as { extensionId: string });
        break;

      case ExtensionHostMessageType.ExtensionError:
        this.handleExtensionError(message.payload as ExtensionErrorPayload);
        break;

      case ExtensionHostMessageType.CommandResult:
        this.handleCommandResult(message.requestId!, message.payload as ApiResponsePayload);
        break;

      case ExtensionHostMessageType.Log:
        this.handleLog(message.payload as { extensionId: string; level: LogLevel; message: string });
        break;

      case ExtensionHostMessageType.Telemetry:
        this.handleTelemetry(message.payload);
        break;

      default:
        console.warn("[ExtensionHost] Unknown message type from worker:", message.type);
    }
  }

  /**
   * Handle worker error.
   */
  private handleWorkerError(event: ErrorEvent): void {
    const error = new Error(event.message || "Worker error");
    console.error("[ExtensionHost] Worker error:", error);

    this.state.status = ExtensionHostStatus.Crashed;
    this.state.lastError = error.message;

    // Reject ready promise if pending
    if (this.readyReject) {
      this.readyReject(error);
      this.readyResolve = null;
      this.readyReject = null;
    }

    // Reject all pending requests
    for (const [_requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();

    this._onDidCrash.fire(error);

    // Attempt restart if under limit
    if (this.state.restartCount < this.config.maxRestarts) {
      console.info(`[ExtensionHost] Attempting restart (${this.state.restartCount + 1}/${this.config.maxRestarts})`);
      this.terminateWorker();
      setTimeout(() => this.restart(), this.config.restartDelay);
    }
  }

  /**
   * Handle ready signal from worker.
   */
  private handleReady(): void {
    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = null;
      this.readyReject = null;
    }
  }

  /**
   * Handle API request from worker.
   */
  private async handleApiRequest(requestId: string, payload: ApiRequestPayload): Promise<void> {
    const { namespace, method, args, extensionId } = payload;

    try {
      const handlers = this.apiHandlers.get(namespace);
      if (!handlers) {
        throw new Error(`Unknown API namespace: ${namespace}`);
      }

      const handler = handlers[method];
      if (!handler) {
        throw new Error(`Unknown API method: ${namespace}.${method}`);
      }

      const result = await handler(extensionId, ...args);

      const response: ApiResponsePayload = { result };
      this.postMessage({
        type: ExtensionHostMessageType.ApiResponse,
        requestId,
        payload: response,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const response: ApiResponsePayload = {
        error: { message: err.message, stack: err.stack },
      };
      this.postMessage({
        type: ExtensionHostMessageType.ApiResponse,
        requestId,
        payload: response,
      });
    }
  }

  /**
   * Handle extension activated event.
   */
  private handleExtensionActivated(payload: ExtensionActivatedPayload): void {
    this.state.extensions.set(payload.extensionId, {
      id: payload.extensionId,
      status: ExtensionStatus.Active,
      activationTime: payload.activationTime,
      lastActivity: Date.now(),
    });

    this._onExtensionActivated.fire(payload);
  }

  /**
   * Handle extension deactivated event.
   */
  private handleExtensionDeactivated(payload: { extensionId: string }): void {
    const state = this.state.extensions.get(payload.extensionId);
    if (state) {
      state.status = ExtensionStatus.Inactive;
    }

    this._onExtensionDeactivated.fire(payload.extensionId);
  }

  /**
   * Handle extension error.
   */
  private handleExtensionError(payload: ExtensionErrorPayload): void {
    const state = this.state.extensions.get(payload.extensionId);
    if (state) {
      state.status = ExtensionStatus.Error;
      state.error = payload.error;
    }

    this._onExtensionError.fire(payload);
  }

  /**
   * Handle command result.
   */
  private handleCommandResult(requestId: string, payload: ApiResponsePayload): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      console.warn(`[ExtensionHost] Received result for unknown request: ${requestId}`);
      return;
    }

    this.pendingRequests.delete(requestId);
    clearTimeout(pending.timeout);

    if (payload.error) {
      pending.reject(new Error(payload.error.message));
    } else {
      pending.resolve(payload.result);
    }
  }

  /**
   * Handle log message.
   */
  private handleLog(payload: { extensionId: string; level: LogLevel; message: string }): void {
    this._onLog.fire(payload);

    // Also log to console based on level
    const prefix = `[${payload.extensionId}]`;
    switch (payload.level) {
      case LogLevel.Trace:
      case LogLevel.Debug:
        console.debug(prefix, payload.message);
        break;
      case LogLevel.Info:
        console.info(prefix, payload.message);
        break;
      case LogLevel.Warning:
        console.warn(prefix, payload.message);
        break;
      case LogLevel.Error:
      case LogLevel.Critical:
        console.error(prefix, payload.message);
        break;
    }
  }

  /**
   * Handle telemetry.
   */
  private handleTelemetry(payload: unknown): void {
    // Would forward to telemetry service
    console.debug("[ExtensionHost] Telemetry:", payload);
  }

  /**
   * Terminate the worker.
   */
  private terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Clear pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
    }
    this.pendingRequests.clear();
  }

  /**
   * Generate a unique request ID.
   */
  private generateRequestId(): string {
    return `main_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Detect the operating system.
   */
  private detectOS(): "windows" | "macos" | "linux" | "unknown" {
    const platform = typeof navigator !== "undefined" ? navigator.platform : "";
    if (platform.startsWith("Win")) return "windows";
    if (platform.startsWith("Mac")) return "macos";
    if (platform.startsWith("Linux")) return "linux";
    return "unknown";
  }

  // ============================================================================
  // Dispose
  // ============================================================================

  dispose(): void {
    this.terminateWorker();
    this.disposables.dispose();
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create and start an extension host.
 */
export async function createExtensionHost(
  config: Partial<ExtensionHostConfig> & {
    workerPath: string;
    extensions: ExtensionDescription[];
  }
): Promise<ExtensionHostMain> {
  const host = new ExtensionHostMain(config);
  await host.start();
  return host;
}
