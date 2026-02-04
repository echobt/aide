/**
 * Extension Context
 *
 * Per-extension context providing storage, secrets, and lifecycle management.
 * Created for each extension during activation.
 */

import {
  Disposable,
  DisposableStore,
  createDisposable,
  EventEmitter,
  createUri,
  LogLevel,
} from "./types";
import {
  ExtensionContext,
  Memento,
  SecretStorage,
  SecretStorageChangeEvent,
  ExtensionMode,
  ExtensionApiBridge,
} from "./ExtensionAPI";

// ============================================================================
// Memento Implementation
// ============================================================================

/**
 * Creates a memento for workspace or global state storage.
 */
export function createMemento(
  extensionId: string,
  scope: "workspace" | "global",
  bridge: ExtensionApiBridge,
  initialData: Record<string, unknown> = {}
): Memento & { setKeysForSync?(keys: string[]): void } {
  const cache = new Map<string, unknown>(Object.entries(initialData));

  const memento: Memento & { setKeysForSync?(keys: string[]): void } = {
    keys(): readonly string[] {
      return Array.from(cache.keys());
    },

    get<T>(key: string, defaultValue?: T): T | undefined {
      const value = cache.get(key);
      return (value !== undefined ? value : defaultValue) as T | undefined;
    },

    async update(key: string, value: unknown): Promise<void> {
      if (value === undefined) {
        cache.delete(key);
      } else {
        cache.set(key, value);
      }

      await bridge.callMainThread(extensionId, "storage", "update", [
        scope,
        key,
        value,
      ]);
    },
  };

  // Only global memento has setKeysForSync
  if (scope === "global") {
    memento.setKeysForSync = (keys: string[]): void => {
      bridge.callMainThread(extensionId, "storage", "setKeysForSync", [keys]);
    };
  }

  return memento;
}

// ============================================================================
// Secret Storage Implementation
// ============================================================================

/**
 * Creates secret storage for sensitive data.
 */
export function createSecretStorage(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): SecretStorage {
  const onDidChangeEmitter = new EventEmitter<SecretStorageChangeEvent>();
  disposables.add(onDidChangeEmitter);

  // Subscribe to secret change events
  disposables.add(
    bridge.subscribeEvent(`secrets.${extensionId}.changed`, (data) => {
      onDidChangeEmitter.fire(data as SecretStorageChangeEvent);
    })
  );

  return {
    async get(key: string): Promise<string | undefined> {
      return bridge.callMainThread<string | undefined>(
        extensionId,
        "secrets",
        "get",
        [key]
      );
    },

    async store(key: string, value: string): Promise<void> {
      await bridge.callMainThread(extensionId, "secrets", "store", [key, value]);
    },

    async delete(key: string): Promise<void> {
      await bridge.callMainThread(extensionId, "secrets", "delete", [key]);
    },

    onDidChange: onDidChangeEmitter.event,
  };
}

// ============================================================================
// Extension Context Implementation
// ============================================================================

export interface CreateExtensionContextOptions {
  extensionId: string;
  extensionPath: string;
  storageBasePath: string;
  globalStorageBasePath: string;
  logPath: string;
  mode: ExtensionMode;
  workspaceState?: Record<string, unknown>;
  globalState?: Record<string, unknown>;
}

/**
 * Creates the extension context for activation.
 */
export function createExtensionContext(
  options: CreateExtensionContextOptions,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): ExtensionContext {
  const {
    extensionId,
    extensionPath,
    storageBasePath,
    globalStorageBasePath,
    logPath,
    mode,
    workspaceState = {},
    globalState = {},
  } = options;

  const subscriptions: Disposable[] = [];

  // Create storage paths
  const storageUri = storageBasePath ? createUri(`${storageBasePath}/${extensionId}`) : undefined;
  const globalStorageUri = createUri(`${globalStorageBasePath}/${extensionId}`);
  const logUri = createUri(`${logPath}/${extensionId}`);

  // Create mementos
  const workspaceMemento = createMemento(extensionId, "workspace", bridge, workspaceState);
  const globalMemento = createMemento(extensionId, "global", bridge, globalState);

  // Create secret storage
  const secrets = createSecretStorage(extensionId, bridge, disposables);

  // Track subscriptions for cleanup
  disposables.add(
    createDisposable(() => {
      subscriptions.forEach((s) => {
        try {
          s.dispose();
        } catch (e) {
          console.error(`[ExtensionContext] Error disposing subscription:`, e);
        }
      });
      subscriptions.length = 0;
    })
  );

  return {
    subscriptions,
    workspaceState: workspaceMemento,
    globalState: globalMemento as Memento & { setKeysForSync(keys: string[]): void },
    secrets,
    extensionPath,
    extensionUri: createUri(extensionPath),
    storageUri,
    globalStorageUri,
    logUri,
    extensionMode: mode,

    asAbsolutePath(relativePath: string): string {
      // Normalize path separators
      const normalized = relativePath.replace(/\\/g, "/");
      const basePath = extensionPath.replace(/\\/g, "/");
      return `${basePath}/${normalized}`.replace(/\/+/g, "/");
    },

    environmentVariableCollection: {
      // Simplified - would need full implementation for terminal env vars
      append: () => {},
      prepend: () => {},
      replace: () => {},
      delete: () => {},
      clear: () => {},
      forEach: () => {},
      get: () => undefined,
      [Symbol.iterator]: function* () {},
    },
  };
}

// ============================================================================
// Extension Logger
// ============================================================================

/**
 * Logger for extension output.
 */
export interface ExtensionLogger {
  trace(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Creates a logger for an extension.
 */
export function createExtensionLogger(
  extensionId: string,
  bridge: ExtensionApiBridge,
  minLevel: LogLevel = LogLevel.Info
): ExtensionLogger {
  function log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (level < minLevel) return;

    const formattedMessage = args.length > 0
      ? `${message} ${args.map((a) => JSON.stringify(a)).join(" ")}`
      : message;

    bridge.log(extensionId, level, formattedMessage);
  }

  return {
    trace: (message, ...args) => log(LogLevel.Trace, message, ...args),
    debug: (message, ...args) => log(LogLevel.Debug, message, ...args),
    info: (message, ...args) => log(LogLevel.Info, message, ...args),
    warn: (message, ...args) => log(LogLevel.Warning, message, ...args),
    error: (message, ...args) => log(LogLevel.Error, message, ...args),
  };
}

// ============================================================================
// Extension Sandbox Globals
// ============================================================================

/**
 * Creates a safe sandbox environment for extension execution.
 * Restricts access to dangerous globals while providing essential APIs.
 */
export function createSandboxGlobals(): Record<string, unknown> {
  // List of allowed globals
  const allowedGlobals = new Set([
    // Primitives and core objects
    "undefined",
    "NaN",
    "Infinity",
    "Object",
    "Function",
    "Boolean",
    "Symbol",
    "Error",
    "EvalError",
    "RangeError",
    "ReferenceError",
    "SyntaxError",
    "TypeError",
    "URIError",
    "AggregateError",

    // Numbers and Math
    "Number",
    "BigInt",
    "Math",

    // Strings
    "String",
    "RegExp",

    // Collections
    "Array",
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Array",
    "Uint32Array",
    "BigInt64Array",
    "BigUint64Array",
    "Float32Array",
    "Float64Array",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "ArrayBuffer",
    "SharedArrayBuffer",
    "DataView",

    // JSON
    "JSON",

    // Control
    "Promise",
    "Proxy",
    "Reflect",

    // Iterators and Generators
    "Iterator",
    "Generator",
    "GeneratorFunction",
    "AsyncFunction",
    "AsyncGenerator",
    "AsyncGeneratorFunction",

    // Encoding
    "encodeURI",
    "encodeURIComponent",
    "decodeURI",
    "decodeURIComponent",
    "escape",
    "unescape",
    "btoa",
    "atob",

    // Parsing
    "parseInt",
    "parseFloat",
    "isNaN",
    "isFinite",

    // Timers (will be wrapped)
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    "queueMicrotask",

    // Text encoding
    "TextEncoder",
    "TextDecoder",

    // URL
    "URL",
    "URLSearchParams",

    // Crypto
    "crypto",

    // Console (will be wrapped)
    "console",

    // Dates
    "Date",

    // Misc
    "Intl",
    "WeakRef",
    "FinalizationRegistry",
  ]);

  // Blocked globals
  const blockedGlobals = new Set([
    "eval",
    "Function", // Will be replaced with safe version
    "fetch", // Controlled through API
    "XMLHttpRequest",
    "WebSocket",
    "Worker",
    "SharedWorker",
    "ServiceWorker",
    "navigator",
    "location",
    "history",
    "document",
    "window",
    "self",
    "globalThis",
    "top",
    "parent",
    "frames",
    "opener",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "caches",
    "importScripts",
  ]);

  // Create sandbox object
  const sandbox: Record<string, unknown> = {};

  // Copy allowed globals from global scope
  for (const name of allowedGlobals) {
    try {
      const value = (globalThis as Record<string, unknown>)[name];
      if (value !== undefined) {
        sandbox[name] = value;
      }
    } catch {
      // Some globals may throw on access
    }
  }

  // Override console to add extension prefix
  sandbox.console = {
    log: (...args: unknown[]) => { if (import.meta.env.DEV) console.log("[Extension]", ...args); },
    info: (...args: unknown[]) => console.info("[Extension]", ...args),
    warn: (...args: unknown[]) => console.warn("[Extension]", ...args),
    error: (...args: unknown[]) => console.error("[Extension]", ...args),
    debug: (...args: unknown[]) => console.debug("[Extension]", ...args),
    trace: (...args: unknown[]) => console.trace("[Extension]", ...args),
    table: (data: unknown) => console.table(data),
    dir: (obj: unknown) => console.dir(obj),
    time: (label: string) => console.time(`[Extension] ${label}`),
    timeEnd: (label: string) => console.timeEnd(`[Extension] ${label}`),
    assert: (condition: boolean, ...args: unknown[]) =>
      console.assert(condition, "[Extension]", ...args),
    count: (label?: string) => console.count(`[Extension] ${label ?? "default"}`),
    countReset: (label?: string) => console.countReset(`[Extension] ${label ?? "default"}`),
    group: (...args: unknown[]) => console.group("[Extension]", ...args),
    groupCollapsed: (...args: unknown[]) => console.groupCollapsed("[Extension]", ...args),
    groupEnd: () => console.groupEnd(),
    clear: () => {}, // Don't allow clearing console
  };

  // Block dangerous globals with proxies that throw
  for (const name of blockedGlobals) {
    Object.defineProperty(sandbox, name, {
      get() {
        throw new Error(`Access to '${name}' is not allowed in extensions`);
      },
      configurable: false,
    });
  }

  return sandbox;
}

// ============================================================================
// Extension Execution Guard
// ============================================================================

/**
 * Guard for limiting extension execution time and resources.
 */
export interface ExecutionGuard {
  /**
   * Check if execution should continue.
   */
  check(): void;

  /**
   * Start tracking a new operation.
   */
  startOperation(): void;

  /**
   * End tracking an operation.
   */
  endOperation(): void;

  /**
   * Get current resource usage.
   */
  getUsage(): ResourceUsage;

  /**
   * Reset resource tracking.
   */
  reset(): void;
}

export interface ResourceUsage {
  executionTimeMs: number;
  operationCount: number;
  memoryEstimateBytes: number;
}

/**
 * Creates an execution guard for an extension.
 */
export function createExecutionGuard(
  extensionId: string,
  limits: {
    maxExecutionTimeMs: number;
    maxOperations: number;
    checkIntervalMs: number;
  }
): ExecutionGuard {
  let startTime = Date.now();
  let operationCount = 0;
  let lastCheck = Date.now();

  return {
    check(): void {
      const now = Date.now();

      // Throttle checks
      if (now - lastCheck < limits.checkIntervalMs) {
        return;
      }
      lastCheck = now;

      const elapsed = now - startTime;
      if (elapsed > limits.maxExecutionTimeMs) {
        throw new Error(
          `Extension '${extensionId}' exceeded maximum execution time (${limits.maxExecutionTimeMs}ms)`
        );
      }

      if (operationCount > limits.maxOperations) {
        throw new Error(
          `Extension '${extensionId}' exceeded maximum operation count (${limits.maxOperations})`
        );
      }
    },

    startOperation(): void {
      operationCount++;
      this.check();
    },

    endOperation(): void {
      // Operation complete
    },

    getUsage(): ResourceUsage {
      return {
        executionTimeMs: Date.now() - startTime,
        operationCount,
        memoryEstimateBytes: 0, // Would need performance.memory API
      };
    },

    reset(): void {
      startTime = Date.now();
      operationCount = 0;
      lastCheck = Date.now();
    },
  };
}
