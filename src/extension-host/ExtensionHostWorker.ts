/**
 * Extension Host Worker
 *
 * Web Worker entry point for running extensions in isolation.
 * Handles message passing, extension lifecycle, and API bridging.
 */

import {
  Disposable,
  DisposableStore,
  createDisposable,
  EventEmitter,
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
  WorkspaceFolder,
  ResourceLimits,
  LogLevel,
} from "./types";
import { ExtensionApiBridge, OrionAPI, createOrionAPI } from "./ExtensionAPI";
import {
  ExtensionActivator,
  ExtensionActivatorOptions,
  ActivatedExtension,
} from "./ExtensionActivator";
import { createSandboxGlobals, createExecutionGuard } from "./ExtensionContext";

// ============================================================================
// Worker Global State
// ============================================================================

let isInitialized = false;
let activator: ExtensionActivator | null = null;
let workspaceFolders: WorkspaceFolder[] = [];
let configuration: Record<string, unknown> = {};
let resourceLimits: ResourceLimits = {
  maxMemoryMB: 512,
  cpuThrottlePercent: 100,
  maxExecutionTimeMs: 30000,
};
let logLevel: LogLevel = LogLevel.Info;

// Event subscriptions from extensions
const eventSubscriptions = new Map<string, Set<(data: unknown) => void>>();

// Pending API requests
const pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

// Request ID counter
let requestIdCounter = 0;

// ============================================================================
// Message Handling
// ============================================================================

/**
 * Send a message to the main thread.
 */
function postMessage(message: ExtensionHostMessage): void {
  self.postMessage(message);
}

/**
 * Generate a unique request ID.
 */
function generateRequestId(): string {
  return `req_${++requestIdCounter}_${Date.now()}`;
}

/**
 * Call the main thread and wait for response.
 */
function callMainThread<T>(
  namespace: string,
  method: string,
  args: unknown[],
  extensionId: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();
    const timeoutMs = 30000; // 30 second timeout

    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`API call timeout: ${namespace}.${method}`));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timeout });

    const payload: ApiRequestPayload = {
      namespace,
      method,
      args,
      extensionId,
    };

    postMessage({
      type: ExtensionHostMessageType.ApiRequest,
      requestId,
      payload,
    });
  });
}

/**
 * Handle API response from main thread.
 */
function handleApiResponse(requestId: string, payload: ApiResponsePayload): void {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    console.warn(`[ExtensionHost] Received response for unknown request: ${requestId}`);
    return;
  }

  pendingRequests.delete(requestId);
  clearTimeout(pending.timeout);

  if (payload.error) {
    pending.reject(new Error(payload.error.message));
  } else {
    pending.resolve(payload.result);
  }
}

/**
 * Handle event from main thread.
 */
function handleEvent(payload: EventPayload): void {
  const { eventName, data } = payload;
  const listeners = eventSubscriptions.get(eventName);

  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`[ExtensionHost] Event listener error for ${eventName}:`, error);
      }
    }
  }
}

// ============================================================================
// API Bridge Implementation
// ============================================================================

/**
 * Create the API bridge for extensions.
 */
function createApiBridge(): ExtensionApiBridge {
  return {
    callMainThread<T>(
      extensionId: string,
      namespace: string,
      method: string,
      args: unknown[]
    ): Promise<T> {
      return callMainThread<T>(namespace, method, args, extensionId);
    },

    subscribeEvent(
      eventName: string,
      listener: (data: unknown) => void
    ): Disposable {
      let listeners = eventSubscriptions.get(eventName);
      if (!listeners) {
        listeners = new Set();
        eventSubscriptions.set(eventName, listeners);
      }
      listeners.add(listener);

      return createDisposable(() => {
        listeners?.delete(listener);
        if (listeners?.size === 0) {
          eventSubscriptions.delete(eventName);
        }
      });
    },

    log(extensionId: string, level: LogLevel, message: string): void {
      postMessage({
        type: ExtensionHostMessageType.Log,
        payload: { extensionId, level, message },
      });
    },
  };
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the extension host.
 */
async function initialize(payload: InitializePayload): Promise<void> {
  if (isInitialized) {
    throw new Error("Extension host already initialized");
  }

  workspaceFolders = payload.workspaceFolders;
  configuration = payload.configuration;
  logLevel = payload.logLevel;
  resourceLimits = payload.resourceLimits;

  const bridge = createApiBridge();

  const activatorOptions: ExtensionActivatorOptions = {
    bridge,
    workspaceFolders,
    storageBasePath: "", // Will be set per-extension
    globalStorageBasePath: "",
    logPath: "",
    logLevel,
  };

  activator = new ExtensionActivator(activatorOptions);

  // Register extensions
  for (const ext of payload.extensions) {
    activator.register(ext);
  }

  // Subscribe to activator events
  activator.onDidActivate((activated) => {
    const activatedPayload: ExtensionActivatedPayload = {
      extensionId: activated.id,
      activationTime: activated.activatedTime,
      exports: undefined, // Can't serialize arbitrary exports
    };

    postMessage({
      type: ExtensionHostMessageType.ExtensionActivated,
      payload: activatedPayload,
    });
  });

  activator.onActivationError(({ extensionId, error }) => {
    const errorPayload: ExtensionErrorPayload = {
      extensionId,
      error: error.message,
      stack: error.stack,
      phase: "activation",
    };

    postMessage({
      type: ExtensionHostMessageType.ExtensionError,
      payload: errorPayload,
    });
  });

  isInitialized = true;

  // Signal ready
  postMessage({
    type: ExtensionHostMessageType.Ready,
    payload: {
      extensionCount: payload.extensions.length,
    },
  });

  // Activate eager extensions
  await activator.activateEager();

  // Then activate startup finished extensions
  await activator.activateOnStartupFinished();
}

/**
 * Shutdown the extension host.
 */
async function shutdown(): Promise<void> {
  if (activator) {
    await activator.dispose();
    activator = null;
  }

  // Clear all pending requests
  for (const [requestId, pending] of pendingRequests) {
    clearTimeout(pending.timeout);
    pending.reject(new Error("Extension host shutting down"));
  }
  pendingRequests.clear();

  // Clear event subscriptions
  eventSubscriptions.clear();

  isInitialized = false;

  postMessage({
    type: ExtensionHostMessageType.ShutdownComplete,
  });
}

// ============================================================================
// Extension Lifecycle
// ============================================================================

/**
 * Activate a specific extension.
 */
async function activateExtension(extensionId: string): Promise<void> {
  if (!activator) {
    throw new Error("Extension host not initialized");
  }

  try {
    await activator.activate(extensionId);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    postMessage({
      type: ExtensionHostMessageType.ExtensionError,
      payload: {
        extensionId,
        error: err.message,
        stack: err.stack,
        phase: "activation",
      } as ExtensionErrorPayload,
    });
  }
}

/**
 * Deactivate a specific extension.
 */
async function deactivateExtension(extensionId: string): Promise<void> {
  if (!activator) {
    throw new Error("Extension host not initialized");
  }

  try {
    await activator.deactivate(extensionId);

    postMessage({
      type: ExtensionHostMessageType.ExtensionDeactivated,
      payload: { extensionId },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    postMessage({
      type: ExtensionHostMessageType.ExtensionError,
      payload: {
        extensionId,
        error: err.message,
        stack: err.stack,
        phase: "deactivation",
      } as ExtensionErrorPayload,
    });
  }
}

/**
 * Execute a command registered by an extension.
 */
async function executeCommand(
  requestId: string,
  commandId: string,
  args: unknown[]
): Promise<void> {
  if (!activator) {
    postMessage({
      type: ExtensionHostMessageType.CommandResult,
      requestId,
      payload: { error: { message: "Extension host not initialized" } },
    });
    return;
  }

  try {
    // Find extension that registered the command
    for (const [_, activated] of [...new Map(Object.entries({}))] /* would iterate activated extensions */) {
      // Commands are handled through the API bridge, this is just a placeholder
    }

    // For now, delegate to main thread command registry
    const result = await callMainThread<unknown>(
      "commands",
      "execute",
      [commandId, ...args],
      "extension-host"
    );

    postMessage({
      type: ExtensionHostMessageType.CommandResult,
      requestId,
      payload: { result },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    postMessage({
      type: ExtensionHostMessageType.CommandResult,
      requestId,
      payload: { error: { message: err.message, stack: err.stack } },
    });
  }
}

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Handle incoming messages from main thread.
 */
function handleMessage(event: MessageEvent<ExtensionHostMessage>): void {
  const message = event.data;

  switch (message.type) {
    case ExtensionHostMessageType.Initialize:
      initialize(message.payload as InitializePayload).catch((error) => {
        postMessage({
          type: ExtensionHostMessageType.ExtensionError,
          payload: {
            extensionId: "extension-host",
            error: error.message,
            stack: error.stack,
            phase: "activation",
          } as ExtensionErrorPayload,
        });
      });
      break;

    case ExtensionHostMessageType.Shutdown:
      shutdown().catch((error) => {
        console.error("[ExtensionHost] Shutdown error:", error);
      });
      break;

    case ExtensionHostMessageType.ActivateExtension:
      activateExtension((message.payload as { extensionId: string }).extensionId);
      break;

    case ExtensionHostMessageType.DeactivateExtension:
      deactivateExtension((message.payload as { extensionId: string }).extensionId);
      break;

    case ExtensionHostMessageType.ApiResponse:
      handleApiResponse(message.requestId!, message.payload as ApiResponsePayload);
      break;

    case ExtensionHostMessageType.Event:
      handleEvent(message.payload as EventPayload);
      break;

    case ExtensionHostMessageType.ExecuteCommand:
      const { commandId, args } = message.payload as { commandId: string; args: unknown[] };
      executeCommand(message.requestId!, commandId, args);
      break;

    default:
      console.warn("[ExtensionHost] Unknown message type:", message.type);
  }
}

// ============================================================================
// Worker Entry Point
// ============================================================================

// Set up message handler
self.addEventListener("message", handleMessage);

// Handle errors
self.addEventListener("error", (event) => {
  console.error("[ExtensionHost] Unhandled error:", event.error);
  postMessage({
    type: ExtensionHostMessageType.ExtensionError,
    payload: {
      extensionId: "extension-host",
      error: event.message || "Unknown error",
      phase: "runtime",
    } as ExtensionErrorPayload,
  });
});

// Handle unhandled promise rejections
self.addEventListener("unhandledrejection", (event) => {
  console.error("[ExtensionHost] Unhandled rejection:", event.reason);
  postMessage({
    type: ExtensionHostMessageType.ExtensionError,
    payload: {
      extensionId: "extension-host",
      error: String(event.reason),
      phase: "runtime",
    } as ExtensionErrorPayload,
  });
});

// Signal that the worker is loaded
postMessage({
  type: ExtensionHostMessageType.Log,
  payload: {
    extensionId: "extension-host",
    level: LogLevel.Info,
    message: "Extension host worker loaded",
  },
});

// Export for testing
export {
  initialize,
  shutdown,
  activateExtension,
  deactivateExtension,
  executeCommand,
};
