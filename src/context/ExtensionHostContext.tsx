/**
 * Extension Host Context
 *
 * SolidJS context provider for the Extension Host system.
 * Provides crash-isolated extension execution with automatic recovery.
 *
 * @example
 * ```tsx
 * // In your app root
 * <ExtensionHostProvider
 *   workerPath="/extension-host-worker.js"
 *   extensions={extensions}
 *   workspaceFolders={folders}
 *   autoStart={true}
 * >
 *   <App />
 * </ExtensionHostProvider>
 *
 * // In any component
 * function MyComponent() {
 *   const { executeCommand, isReady } = useExtensionHost();
 *
 *   const handleClick = async () => {
 *     if (isReady()) {
 *       await executeCommand("myExtension.doSomething");
 *     }
 *   };
 *
 *   return <button onClick={handleClick}>Execute</button>;
 * }
 * ```
 */

import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  onCleanup,
  onMount,
  Accessor,
  ParentProps,
  createMemo,
  batch,
  Component,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

import {
  ExtensionHostMain,
  ExtensionHostStatus,
  createExtensionHost,
} from "../extension-host/ExtensionHostMain";
import {
  ExtensionDescription,
  ExtensionRuntimeState,
  ExtensionStatus,
  ExtensionActivatedPayload,
  ExtensionErrorPayload,
  WorkspaceFolder,
  LogLevel,
  Disposable,
  createUri,
} from "../extension-host/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Log entry from extensions.
 */
export interface ExtensionLogEntry {
  id: string;
  timestamp: number;
  extensionId: string;
  level: LogLevel;
  message: string;
}

/**
 * Extension host statistics.
 */
export interface ExtensionHostStats {
  status: ExtensionHostStatus;
  uptime: number;
  extensionCount: number;
  activeExtensions: number;
  totalActivationTime: number;
  restartCount: number;
  lastCrash?: {
    timestamp: number;
    error: string;
  };
}

/**
 * Extension host configuration options.
 */
export interface ExtensionHostOptions {
  /** Path to the extension host worker script */
  workerPath: string;
  /** Extensions to load */
  extensions: ExtensionDescription[];
  /** Workspace folders */
  workspaceFolders?: WorkspaceFolder[];
  /** Initial configuration */
  configuration?: Record<string, unknown>;
  /** Log level */
  logLevel?: LogLevel;
  /** Maximum logs to keep in memory */
  maxLogs?: number;
  /** Auto-start on mount */
  autoStart?: boolean;
  /** Auto-restart on crash */
  autoRestart?: boolean;
  /** Maximum restart attempts */
  maxRestarts?: number;
  /** Restart delay in ms */
  restartDelay?: number;
}

/**
 * Extension host context value.
 */
export interface ExtensionHostAPI {
  // State accessors
  /** Current host status */
  status: Accessor<ExtensionHostStatus>;
  /** Whether host is ready to accept commands */
  isReady: Accessor<boolean>;
  /** Whether host is starting */
  isStarting: Accessor<boolean>;
  /** All extension runtime states */
  extensions: Accessor<ExtensionRuntimeState[]>;
  /** Only active extensions */
  activeExtensions: Accessor<ExtensionRuntimeState[]>;
  /** Extension logs */
  logs: Accessor<ExtensionLogEntry[]>;
  /** Host statistics */
  stats: Accessor<ExtensionHostStats>;
  /** Last error if any */
  lastError: Accessor<Error | null>;

  // Lifecycle actions
  /** Start the extension host */
  start: () => Promise<void>;
  /** Stop the extension host */
  stop: () => Promise<void>;
  /** Restart the extension host */
  restart: () => Promise<void>;

  // Extension control
  /** Activate a specific extension */
  activateExtension: (extensionId: string) => Promise<void>;
  /** Deactivate a specific extension */
  deactivateExtension: (extensionId: string) => Promise<void>;
  /** Get state of a specific extension */
  getExtensionState: (extensionId: string) => ExtensionRuntimeState | undefined;
  /** Check if an extension is active */
  isExtensionActive: (extensionId: string) => boolean;

  // Command execution
  /** Execute a command by ID */
  executeCommand: <T = unknown>(commandId: string, ...args: unknown[]) => Promise<T>;
  /** Register a command handler */
  registerCommand: (commandId: string, handler: (...args: unknown[]) => unknown) => Disposable;

  // Events
  /** Send an event to all extensions */
  sendEvent: (eventName: string, data: unknown) => void;

  // Advanced
  /** Get the underlying host instance */
  getHost: () => ExtensionHostMain | null;
  /** Clear all logs */
  clearLogs: () => void;
  /** Get logs for a specific extension */
  getExtensionLogs: (extensionId: string) => ExtensionLogEntry[];
}

// ============================================================================
// Context
// ============================================================================

const ExtensionHostContext = createContext<ExtensionHostAPI>();

/**
 * Hook to access the extension host context.
 * Must be used within an ExtensionHostProvider.
 */
export function useExtensionHost(): ExtensionHostAPI {
  const context = useContext(ExtensionHostContext);
  if (!context) {
    throw new Error(
      "useExtensionHost must be used within an ExtensionHostProvider"
    );
  }
  return context;
}

// ============================================================================
// Provider Props
// ============================================================================

export interface ExtensionHostProviderProps extends ParentProps, ExtensionHostOptions {
  /** Called when host becomes ready */
  onReady?: () => void;
  /** Called when an extension is activated */
  onExtensionActivated?: (payload: ExtensionActivatedPayload) => void;
  /** Called when an extension errors */
  onExtensionError?: (payload: ExtensionErrorPayload) => void;
  /** Called when host crashes */
  onCrash?: (error: Error) => void;
  /** Called when host restarts */
  onRestart?: (attempt: number) => void;
}

// ============================================================================
// Provider Implementation
// ============================================================================

/**
 * Provider component for the extension host.
 * Manages lifecycle and provides context to children.
 */
export const ExtensionHostProvider: Component<ExtensionHostProviderProps> = (props) => {
  // Configuration with defaults
  const maxLogs = () => props.maxLogs ?? 1000;
  const autoStart = () => props.autoStart ?? true;
  const autoRestart = () => props.autoRestart ?? true;
  const maxRestarts = () => props.maxRestarts ?? 3;
  const restartDelay = () => props.restartDelay ?? 1000;

  // State
  const [status, setStatus] = createSignal<ExtensionHostStatus>(
    ExtensionHostStatus.Stopped
  );
  const [extensions, setExtensions] = createStore<ExtensionRuntimeState[]>([]);
  const [logs, setLogs] = createSignal<ExtensionLogEntry[]>([]);
  const [lastError, setLastError] = createSignal<Error | null>(null);
  const [startTime, setStartTime] = createSignal<number | null>(null);
  const [restartCount, setRestartCount] = createSignal(0);
  const [lastCrash, setLastCrash] = createSignal<{ timestamp: number; error: string } | null>(null);

  // Host instance
  let host: ExtensionHostMain | null = null;
  let logIdCounter = 0;

  // Derived state
  const isReady = createMemo(() => status() === ExtensionHostStatus.Ready);
  const isStarting = createMemo(() => status() === ExtensionHostStatus.Starting);
  const activeExtensions = createMemo(() =>
    extensions.filter((e) => e.status === ExtensionStatus.Active)
  );

  const stats = createMemo((): ExtensionHostStats => {
    const start = startTime();
    return {
      status: status(),
      uptime: start ? Date.now() - start : 0,
      extensionCount: extensions.length,
      activeExtensions: activeExtensions().length,
      totalActivationTime: extensions.reduce(
        (sum, e) => sum + (e.activationTime ?? 0),
        0
      ),
      restartCount: restartCount(),
      lastCrash: lastCrash() ?? undefined,
    };
  });

  // ============================================================================
  // Extension State Management
  // ============================================================================

  const updateExtensionState = (
    extensionId: string,
    update: Partial<ExtensionRuntimeState>
  ): void => {
    setExtensions(
      produce((draft) => {
        const index = draft.findIndex((e) => e.id === extensionId);
        if (index >= 0) {
          Object.assign(draft[index], update, { lastActivity: Date.now() });
        } else {
          draft.push({
            id: extensionId,
            status: ExtensionStatus.Inactive,
            ...update,
            lastActivity: Date.now(),
          } as ExtensionRuntimeState);
        }
      })
    );
  };

  const addLog = (entry: Omit<ExtensionLogEntry, "id">): void => {
    const log: ExtensionLogEntry = {
      ...entry,
      id: `log_${++logIdCounter}_${Date.now()}`,
    };

    setLogs((prev) => {
      const next = [...prev, log];
      const max = maxLogs();
      if (next.length > max) {
        return next.slice(-max);
      }
      return next;
    });
  };

  // ============================================================================
  // Host Lifecycle
  // ============================================================================

  const start = async (): Promise<void> => {
    if (host) {
      console.warn("[ExtensionHostProvider] Host already started");
      return;
    }

    if (props.extensions.length === 0) {
      console.info("[ExtensionHostProvider] No extensions to load");
      setStatus(ExtensionHostStatus.Ready);
      return;
    }

    setStatus(ExtensionHostStatus.Starting);
    setLastError(null);

    try {
      host = await createExtensionHost({
        workerPath: props.workerPath,
        extensions: props.extensions,
        workspaceFolders: props.workspaceFolders ?? [],
        configuration: props.configuration ?? {},
        logLevel: props.logLevel ?? LogLevel.Info,
        maxRestarts: maxRestarts(),
        restartDelay: restartDelay(),
      });

      setupHostEventHandlers(host);

      // Initialize extension states
      const initialStates: ExtensionRuntimeState[] = props.extensions.map((ext) => ({
        id: ext.id,
        status: ExtensionStatus.Inactive,
      }));
      setExtensions(initialStates);

      setStartTime(Date.now());

      // Wait for ready signal from worker
      await host.whenReady();

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setLastError(err);
      setStatus(ExtensionHostStatus.Crashed);

      // Cleanup partial state
      if (host) {
        host.dispose();
        host = null;
      }

      throw err;
    }
  };

  const stop = async (): Promise<void> => {
    if (!host) {
      return;
    }

    try {
      await host.stop();
    } catch (error) {
      console.error("[ExtensionHostProvider] Error stopping host:", error);
    } finally {
      host.dispose();
      host = null;
      setExtensions([]);
      setStartTime(null);
      setStatus(ExtensionHostStatus.Stopped);
    }
  };

  const restart = async (): Promise<void> => {
    await stop();
    setRestartCount((c) => c + 1);
    props.onRestart?.(restartCount());
    await start();
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const setupHostEventHandlers = (hostInstance: ExtensionHostMain): void => {
    hostInstance.onDidStart(() => {
      batch(() => {
        setStatus(ExtensionHostStatus.Ready);
        setLastError(null);
      });
      props.onReady?.();

      addLog({
        timestamp: Date.now(),
        extensionId: "extension-host",
        level: LogLevel.Info,
        message: "Extension host ready",
      });
    });

    hostInstance.onDidStop(() => {
      setStatus(ExtensionHostStatus.Stopped);

      addLog({
        timestamp: Date.now(),
        extensionId: "extension-host",
        level: LogLevel.Info,
        message: "Extension host stopped",
      });
    });

    hostInstance.onDidCrash((error) => {
      batch(() => {
        setStatus(ExtensionHostStatus.Crashed);
        setLastError(error);
        setLastCrash({ timestamp: Date.now(), error: error.message });
      });

      addLog({
        timestamp: Date.now(),
        extensionId: "extension-host",
        level: LogLevel.Error,
        message: `Extension host crashed: ${error.message}`,
      });

      props.onCrash?.(error);

      // Auto-restart if enabled and under limit
      if (autoRestart() && restartCount() < maxRestarts()) {
        console.info(
          `[ExtensionHostProvider] Auto-restarting (attempt ${restartCount() + 1}/${maxRestarts()})`
        );
        setTimeout(() => {
          restart().catch((err) => {
            console.error("[ExtensionHostProvider] Auto-restart failed:", err);
          });
        }, restartDelay());
      }
    });

    hostInstance.onDidRestart((count) => {
      setRestartCount(count);

      addLog({
        timestamp: Date.now(),
        extensionId: "extension-host",
        level: LogLevel.Warning,
        message: `Extension host restarted (attempt ${count})`,
      });

      props.onRestart?.(count);
    });

    hostInstance.onExtensionActivated((payload) => {
      updateExtensionState(payload.extensionId, {
        status: ExtensionStatus.Active,
        activationTime: payload.activationTime,
        exports: payload.exports,
      });

      addLog({
        timestamp: Date.now(),
        extensionId: payload.extensionId,
        level: LogLevel.Info,
        message: `Activated in ${payload.activationTime}ms`,
      });

      props.onExtensionActivated?.(payload);
    });

    hostInstance.onExtensionDeactivated((extensionId) => {
      updateExtensionState(extensionId, {
        status: ExtensionStatus.Inactive,
        exports: undefined,
      });

      addLog({
        timestamp: Date.now(),
        extensionId,
        level: LogLevel.Info,
        message: "Deactivated",
      });
    });

    hostInstance.onExtensionError((payload) => {
      updateExtensionState(payload.extensionId, {
        status: ExtensionStatus.Error,
        error: payload.error,
      });

      addLog({
        timestamp: Date.now(),
        extensionId: payload.extensionId,
        level: LogLevel.Error,
        message: `Error during ${payload.phase}: ${payload.error}`,
      });

      props.onExtensionError?.(payload);
    });

    hostInstance.onLog((entry) => {
      addLog({
        timestamp: Date.now(),
        extensionId: entry.extensionId,
        level: entry.level,
        message: entry.message,
      });
    });
  };

  // ============================================================================
  // Extension Control
  // ============================================================================

  const activateExtension = async (extensionId: string): Promise<void> => {
    if (!host) {
      throw new Error("Extension host not started");
    }

    updateExtensionState(extensionId, {
      status: ExtensionStatus.Activating,
    });

    try {
      await host.activateExtension(extensionId);
    } catch (error) {
      updateExtensionState(extensionId, {
        status: ExtensionStatus.Error,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const deactivateExtension = async (extensionId: string): Promise<void> => {
    if (!host) {
      throw new Error("Extension host not started");
    }

    updateExtensionState(extensionId, {
      status: ExtensionStatus.Deactivating,
    });

    try {
      await host.deactivateExtension(extensionId);
    } catch (error) {
      updateExtensionState(extensionId, {
        status: ExtensionStatus.Error,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const getExtensionState = (extensionId: string): ExtensionRuntimeState | undefined => {
    return extensions.find((e) => e.id === extensionId);
  };

  const isExtensionActive = (extensionId: string): boolean => {
    const state = getExtensionState(extensionId);
    return state?.status === ExtensionStatus.Active;
  };

  // ============================================================================
  // Command Execution
  // ============================================================================

  const executeCommand = async <T = unknown>(
    commandId: string,
    ...args: unknown[]
  ): Promise<T> => {
    if (!host) {
      throw new Error("Extension host not started");
    }

    if (!isReady()) {
      throw new Error("Extension host not ready");
    }

    return host.executeCommand<T>(commandId, ...args);
  };

  const registerCommand = (
    commandId: string,
    handler: (...args: unknown[]) => unknown
  ): Disposable => {
    if (!host) {
      throw new Error("Extension host not started");
    }

    return host.registerCommand(commandId, handler);
  };

  // ============================================================================
  // Events
  // ============================================================================

  const sendEvent = (eventName: string, data: unknown): void => {
    host?.sendEvent(eventName, data);
  };

  // ============================================================================
  // Utilities
  // ============================================================================

  const getHost = (): ExtensionHostMain | null => host;

  const clearLogs = (): void => {
    setLogs([]);
  };

  const getExtensionLogs = (extensionId: string): ExtensionLogEntry[] => {
    return logs().filter((log) => log.extensionId === extensionId);
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    if (autoStart()) {
      start().catch((error) => {
        console.error("[ExtensionHostProvider] Auto-start failed:", error);
      });
    }
  });

  onCleanup(() => {
    stop().catch((error) => {
      console.error("[ExtensionHostProvider] Cleanup failed:", error);
    });
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const api: ExtensionHostAPI = {
    // State
    status,
    isReady,
    isStarting,
    extensions: () => extensions,
    activeExtensions,
    logs,
    stats,
    lastError,

    // Lifecycle
    start,
    stop,
    restart,

    // Extension control
    activateExtension,
    deactivateExtension,
    getExtensionState,
    isExtensionActive,

    // Commands
    executeCommand,
    registerCommand,

    // Events
    sendEvent,

    // Advanced
    getHost,
    clearLogs,
    getExtensionLogs,
  };

  return (
    <ExtensionHostContext.Provider value={api}>
      {props.children}
    </ExtensionHostContext.Provider>
  );
};

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to get a specific extension's runtime state.
 */
export function useExtension(extensionId: string): Accessor<ExtensionRuntimeState | undefined> {
  const { extensions } = useExtensionHost();
  return createMemo(() => extensions().find((e) => e.id === extensionId));
}

/**
 * Hook to check if a specific extension is active.
 */
export function useExtensionActive(extensionId: string): Accessor<boolean> {
  const extension = useExtension(extensionId);
  return createMemo(() => extension()?.status === ExtensionStatus.Active);
}

/**
 * Hook to execute a specific command.
 * Returns a function that will execute the command when called.
 */
export function useCommand<T = unknown, Args extends unknown[] = unknown[]>(
  commandId: string
): (...args: Args) => Promise<T> {
  const { executeCommand, isReady } = useExtensionHost();

  return async (...args: Args): Promise<T> => {
    if (!isReady()) {
      throw new Error("Extension host not ready");
    }
    return executeCommand<T>(commandId, ...args);
  };
}

/**
 * Hook to register a command handler.
 * Handler is automatically disposed when component unmounts.
 */
export function useCommandHandler(
  commandId: string,
  handler: (...args: unknown[]) => unknown
): void {
  const { registerCommand, isReady } = useExtensionHost();

  createEffect(() => {
    if (isReady()) {
      const disposable = registerCommand(commandId, handler);
      onCleanup(() => disposable.dispose());
    }
  });
}

/**
 * Hook to get filtered logs.
 */
export function useExtensionLogs(
  extensionId?: string,
  minLevel?: LogLevel
): Accessor<ExtensionLogEntry[]> {
  const { logs } = useExtensionHost();

  return createMemo(() => {
    let filtered = logs();

    if (extensionId) {
      filtered = filtered.filter((log) => log.extensionId === extensionId);
    }

    if (minLevel !== undefined) {
      filtered = filtered.filter((log) => log.level >= minLevel);
    }

    return filtered;
  });
}

/**
 * Hook to send events to extensions.
 * Returns a function that sends the event when called.
 */
export function useExtensionEvent(eventName: string): (data: unknown) => void {
  const { sendEvent, isReady } = useExtensionHost();

  return (data: unknown): void => {
    if (isReady()) {
      sendEvent(eventName, data);
    }
  };
}

/**
 * Hook to track extension host statistics.
 */
export function useExtensionHostStats(): Accessor<ExtensionHostStats> {
  const { stats } = useExtensionHost();
  return stats;
}

/**
 * Hook that returns true when the extension host is ready.
 * Useful for conditional rendering.
 */
export function useExtensionHostReady(): Accessor<boolean> {
  const { isReady } = useExtensionHost();
  return isReady;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create workspace folders from paths.
 */
export function createWorkspaceFolders(paths: string[]): WorkspaceFolder[] {
  return paths.map((path, index) => ({
    uri: createUri(path),
    name: path.split(/[/\\]/).pop() ?? path,
    index,
  }));
}

/**
 * Convert a manifest to an extension description.
 */
export function manifestToDescription(
  manifest: {
    name: string;
    version: string;
    main?: string;
    activationEvents?: string[];
    dependencies?: string[];
    extensionKind?: ("ui" | "workspace")[];
  },
  path: string
): ExtensionDescription {
  return {
    id: manifest.name,
    name: manifest.name,
    version: manifest.version,
    path,
    main: manifest.main ?? "dist/extension.js",
    activationEvents: manifest.activationEvents ?? ["*"],
    dependencies: manifest.dependencies ?? [],
    extensionKind: (manifest.extensionKind ?? ["workspace"]).map((k) =>
      k === "ui" ? 1 : 2
    ),
  };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export {
  ExtensionStatus,
  LogLevel,
} from "../extension-host/types";

export {
  ExtensionHostStatus,
} from "../extension-host/ExtensionHostMain";

export type {
  ExtensionDescription,
  ExtensionRuntimeState,
  ExtensionActivatedPayload,
  ExtensionErrorPayload,
  WorkspaceFolder,
} from "../extension-host/types";
