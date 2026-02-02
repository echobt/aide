/**
 * Extension Host SolidJS Integration
 *
 * Provides reactive hooks and context for using the extension host
 * within SolidJS components.
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
} from "solid-js";
import { createStore, produce } from "solid-js/store";

import {
  ExtensionHostMain,
  ExtensionHostConfig,
  ExtensionHostStatus,
  createExtensionHost,
} from "./ExtensionHostMain";
import {
  ExtensionDescription,
  ExtensionRuntimeState,
  ExtensionStatus,
  ExtensionActivatedPayload,
  ExtensionErrorPayload,
  WorkspaceFolder,
  LogLevel,
  createUri,
} from "./types";
import { manifestToDescription, ExtensionManifest } from "./index";

// ============================================================================
// Context Types
// ============================================================================

export interface ExtensionHostContextValue {
  // State
  status: Accessor<ExtensionHostStatus>;
  isReady: Accessor<boolean>;
  extensions: Accessor<ExtensionRuntimeState[]>;
  activeExtensions: Accessor<ExtensionRuntimeState[]>;
  logs: Accessor<ExtensionLogEntry[]>;

  // Actions
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
  activateExtension: (extensionId: string) => Promise<void>;
  deactivateExtension: (extensionId: string) => Promise<void>;
  executeCommand: <T = unknown>(commandId: string, ...args: unknown[]) => Promise<T>;
  sendEvent: (eventName: string, data: unknown) => void;

  // Host instance (for advanced usage)
  getHost: () => ExtensionHostMain | null;
}

export interface ExtensionLogEntry {
  timestamp: number;
  extensionId: string;
  level: LogLevel;
  message: string;
}

// ============================================================================
// Context
// ============================================================================

const ExtensionHostContext = createContext<ExtensionHostContextValue>();

/**
 * Get the extension host context.
 */
export function useExtensionHost(): ExtensionHostContextValue {
  const context = useContext(ExtensionHostContext);
  if (!context) {
    throw new Error("useExtensionHost must be used within an ExtensionHostProvider");
  }
  return context;
}

// ============================================================================
// Provider Props
// ============================================================================

export interface ExtensionHostProviderProps extends ParentProps {
  /**
   * Path to the extension host worker script.
   */
  workerPath: string;

  /**
   * Extensions to load.
   */
  extensions: ExtensionDescription[];

  /**
   * Workspace folders.
   */
  workspaceFolders?: WorkspaceFolder[];

  /**
   * Initial configuration.
   */
  configuration?: Record<string, unknown>;

  /**
   * Log level.
   */
  logLevel?: LogLevel;

  /**
   * Maximum logs to keep in memory.
   */
  maxLogs?: number;

  /**
   * Auto-start the extension host.
   */
  autoStart?: boolean;

  /**
   * Called when host is ready.
   */
  onReady?: () => void;

  /**
   * Called when an extension is activated.
   */
  onExtensionActivated?: (payload: ExtensionActivatedPayload) => void;

  /**
   * Called when an extension error occurs.
   */
  onExtensionError?: (payload: ExtensionErrorPayload) => void;

  /**
   * Called when host crashes.
   */
  onCrash?: (error: Error) => void;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * Provider component for the extension host.
 */
export function ExtensionHostProvider(props: ExtensionHostProviderProps) {
  const maxLogs = props.maxLogs ?? 1000;

  // State
  const [status, setStatus] = createSignal<ExtensionHostStatus>(
    ExtensionHostStatus.Stopped
  );
  const [extensions, setExtensions] = createStore<ExtensionRuntimeState[]>([]);
  const [logs, setLogs] = createSignal<ExtensionLogEntry[]>([]);

  // Host instance
  let host: ExtensionHostMain | null = null;

  // Derived state
  const isReady = createMemo(() => status() === ExtensionHostStatus.Ready);
  const activeExtensions = createMemo(() =>
    extensions.filter((e) => e.status === ExtensionStatus.Active)
  );

  // ============================================================================
  // Host Management
  // ============================================================================

  const start = async (): Promise<void> => {
    if (host) {
      console.warn("[ExtensionHostProvider] Host already started");
      return;
    }

    setStatus(ExtensionHostStatus.Starting);

    try {
      host = await createExtensionHost({
        workerPath: props.workerPath,
        extensions: props.extensions,
        workspaceFolders: props.workspaceFolders ?? [],
        configuration: props.configuration ?? {},
        logLevel: props.logLevel ?? LogLevel.Info,
      });

      // Set up event handlers
      host.onDidStart(() => {
        setStatus(ExtensionHostStatus.Ready);
        props.onReady?.();
      });

      host.onDidStop(() => {
        setStatus(ExtensionHostStatus.Stopped);
      });

      host.onDidCrash((error) => {
        setStatus(ExtensionHostStatus.Crashed);
        props.onCrash?.(error);
      });

      host.onExtensionActivated((payload) => {
        updateExtensionState(payload.extensionId, {
          status: ExtensionStatus.Active,
          activationTime: payload.activationTime,
          lastActivity: Date.now(),
        });
        props.onExtensionActivated?.(payload);
      });

      host.onExtensionDeactivated((extensionId) => {
        updateExtensionState(extensionId, {
          status: ExtensionStatus.Inactive,
          lastActivity: Date.now(),
        });
      });

      host.onExtensionError((payload) => {
        updateExtensionState(payload.extensionId, {
          status: ExtensionStatus.Error,
          error: payload.error,
        });
        props.onExtensionError?.(payload);
      });

      host.onLog((entry) => {
        addLog({
          timestamp: Date.now(),
          extensionId: entry.extensionId,
          level: entry.level,
          message: entry.message,
        });
      });

      // Initialize extension states
      const states = host.getAllExtensionStates();
      setExtensions(states);
    } catch (error) {
      setStatus(ExtensionHostStatus.Crashed);
      throw error;
    }
  };

  const stop = async (): Promise<void> => {
    if (!host) {
      return;
    }

    await host.stop();
    host.dispose();
    host = null;
    setExtensions([]);
  };

  const restart = async (): Promise<void> => {
    await stop();
    await start();
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

    await host.activateExtension(extensionId);
  };

  const deactivateExtension = async (extensionId: string): Promise<void> => {
    if (!host) {
      throw new Error("Extension host not started");
    }

    updateExtensionState(extensionId, {
      status: ExtensionStatus.Deactivating,
    });

    await host.deactivateExtension(extensionId);
  };

  const executeCommand = async <T = unknown>(
    commandId: string,
    ...args: unknown[]
  ): Promise<T> => {
    if (!host) {
      throw new Error("Extension host not started");
    }

    return host.executeCommand<T>(commandId, ...args);
  };

  const sendEvent = (eventName: string, data: unknown): void => {
    host?.sendEvent(eventName, data);
  };

  const getHost = (): ExtensionHostMain | null => host;

  // ============================================================================
  // Helpers
  // ============================================================================

  const updateExtensionState = (
    extensionId: string,
    update: Partial<ExtensionRuntimeState>
  ): void => {
    setExtensions(
      produce((draft) => {
        const index = draft.findIndex((e) => e.id === extensionId);
        if (index >= 0) {
          Object.assign(draft[index], update);
        } else {
          draft.push({
            id: extensionId,
            status: ExtensionStatus.Inactive,
            ...update,
          } as ExtensionRuntimeState);
        }
      })
    );
  };

  const addLog = (entry: ExtensionLogEntry): void => {
    setLogs((prev) => {
      const next = [...prev, entry];
      if (next.length > maxLogs) {
        return next.slice(-maxLogs);
      }
      return next;
    });
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    if (props.autoStart !== false) {
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

  const value: ExtensionHostContextValue = {
    status,
    isReady,
    extensions: () => extensions,
    activeExtensions,
    logs,

    start,
    stop,
    restart,
    activateExtension,
    deactivateExtension,
    executeCommand,
    sendEvent,
    getHost,
  };

  return (
    <ExtensionHostContext.Provider value={value}>
      {props.children}
    </ExtensionHostContext.Provider>
  );
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to get a specific extension's state.
 */
export function useExtension(extensionId: string): Accessor<ExtensionRuntimeState | undefined> {
  const { extensions } = useExtensionHost();
  return createMemo(() => extensions().find((e) => e.id === extensionId));
}

/**
 * Hook to check if an extension is active.
 */
export function useExtensionActive(extensionId: string): Accessor<boolean> {
  const extension = useExtension(extensionId);
  return createMemo(() => extension()?.status === ExtensionStatus.Active);
}

/**
 * Hook to execute commands.
 */
export function useCommand<T = unknown>(
  commandId: string
): (...args: unknown[]) => Promise<T> {
  const { executeCommand, isReady } = useExtensionHost();

  return async (...args: unknown[]): Promise<T> => {
    if (!isReady()) {
      throw new Error("Extension host not ready");
    }
    return executeCommand<T>(commandId, ...args);
  };
}

/**
 * Hook to filter logs by extension.
 */
export function useExtensionLogs(
  extensionId?: string,
  level?: LogLevel
): Accessor<ExtensionLogEntry[]> {
  const { logs } = useExtensionHost();

  return createMemo(() => {
    let filtered = logs();

    if (extensionId) {
      filtered = filtered.filter((l) => l.extensionId === extensionId);
    }

    if (level !== undefined) {
      filtered = filtered.filter((l) => l.level >= level);
    }

    return filtered;
  });
}

/**
 * Hook to send events to extensions.
 */
export function useExtensionEvent(
  eventName: string
): (data: unknown) => void {
  const { sendEvent, isReady } = useExtensionHost();

  return (data: unknown): void => {
    if (isReady()) {
      sendEvent(eventName, data);
    }
  };
}

// ============================================================================
// Extension Registration Helpers
// ============================================================================

/**
 * Convert manifest objects to extension descriptions.
 */
export function createExtensionDescriptions(
  manifests: Array<{ manifest: ExtensionManifest; path: string }>
): ExtensionDescription[] {
  return manifests.map(({ manifest, path }) =>
    manifestToDescription(manifest, path)
  );
}

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
