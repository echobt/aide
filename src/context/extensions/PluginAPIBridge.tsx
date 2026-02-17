/**
 * PluginAPIBridge - Bridges Tauri backend plugin events with frontend UI
 *
 * Manages message display, permission request dialogs, and contributed
 * view updates from extensions running in the backend runtime. Listens
 * for Tauri events and maintains queues for UI consumption.
 */

import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  ParentProps,
  Accessor,
  createSignal,
  JSX,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// ============================================================================
// Types
// ============================================================================

export type PluginMessageSeverity = "info" | "warning" | "error";

export interface PluginMessage {
  id: string;
  extensionId: string;
  severity: PluginMessageSeverity;
  message: string;
  actions?: string[];
  timestamp: number;
}

export interface PermissionRequest {
  requestId: string;
  extensionId: string;
  permission: string;
  description: string;
  timestamp: number;
}

export interface ContributedViewUpdate {
  extensionId: string;
  viewId: string;
  data: unknown;
}

interface ShowMessagePayload {
  id: string;
  extensionId: string;
  severity: PluginMessageSeverity;
  message: string;
  actions?: string[];
}

interface PermissionRequestPayload {
  requestId: string;
  extensionId: string;
  permission: string;
  description: string;
}

interface ContributedViewUpdatePayload {
  extensionId: string;
  viewId: string;
  data: unknown;
}

export interface PluginAPIBridgeContextValue {
  messages: Accessor<PluginMessage[]>;
  pendingPermissions: Accessor<PermissionRequest[]>;
  respondToPermissionRequest: (
    requestId: string,
    approved: boolean,
  ) => Promise<void>;
  dismissMessage: (messageId: string) => void;
  getActiveMessages: () => PluginMessage[];
  getPendingPermissions: () => PermissionRequest[];
}

// ============================================================================
// Context
// ============================================================================

const PluginAPIBridgeContext = createContext<PluginAPIBridgeContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function PluginAPIBridgeProvider(props: ParentProps): JSX.Element {
  const [messages, setMessages] = createSignal<PluginMessage[]>([]);
  const [pendingPermissions, setPendingPermissions] = createSignal<
    PermissionRequest[]
  >([]);

  const unlistenFns: UnlistenFn[] = [];

  const respondToPermissionRequest = async (
    requestId: string,
    approved: boolean,
  ): Promise<void> => {
    try {
      await invoke("plugin_respond_permission_request", {
        requestId,
        approved,
      });

      setPendingPermissions((prev) =>
        prev.filter((req) => req.requestId !== requestId),
      );
    } catch (e) {
      console.error(
        "[PluginAPIBridge] Failed to respond to permission request:",
        e,
      );
      throw e;
    }
  };

  const dismissMessage = (messageId: string): void => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  };

  const getActiveMessages = (): PluginMessage[] => {
    return messages();
  };

  const getPendingPermissions = (): PermissionRequest[] => {
    return pendingPermissions();
  };

  onMount(async () => {
    try {
      const unlistenMessage = await listen<ShowMessagePayload>(
        "plugin:show-message",
        (event) => {
          const payload = event.payload;
          const pluginMessage: PluginMessage = {
            id: payload.id,
            extensionId: payload.extensionId,
            severity: payload.severity,
            message: payload.message,
            actions: payload.actions,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, pluginMessage]);
        },
      );
      unlistenFns.push(unlistenMessage);
    } catch (e) {
      console.warn(
        "[PluginAPIBridge] Failed to listen for show-message events:",
        e,
      );
    }

    try {
      const unlistenPermission = await listen<PermissionRequestPayload>(
        "plugin:permission-request",
        (event) => {
          const payload = event.payload;
          const request: PermissionRequest = {
            requestId: payload.requestId,
            extensionId: payload.extensionId,
            permission: payload.permission,
            description: payload.description,
            timestamp: Date.now(),
          };
          setPendingPermissions((prev) => [...prev, request]);
        },
      );
      unlistenFns.push(unlistenPermission);
    } catch (e) {
      console.warn(
        "[PluginAPIBridge] Failed to listen for permission-request events:",
        e,
      );
    }

    try {
      const unlistenViewUpdate = await listen<ContributedViewUpdatePayload>(
        "plugin:contributed-view-update",
        (event) => {
          const payload = event.payload;
          window.dispatchEvent(
            new CustomEvent("plugin:view-update", {
              detail: {
                extensionId: payload.extensionId,
                viewId: payload.viewId,
                data: payload.data,
              } satisfies ContributedViewUpdate,
            }),
          );
        },
      );
      unlistenFns.push(unlistenViewUpdate);
    } catch (e) {
      console.warn(
        "[PluginAPIBridge] Failed to listen for contributed-view-update events:",
        e,
      );
    }
  });

  onCleanup(() => {
    for (const unlisten of unlistenFns) {
      unlisten();
    }
    unlistenFns.length = 0;
  });

  const value: PluginAPIBridgeContextValue = {
    messages,
    pendingPermissions,
    respondToPermissionRequest,
    dismissMessage,
    getActiveMessages,
    getPendingPermissions,
  };

  return (
    <PluginAPIBridgeContext.Provider value={value}>
      {props.children}
    </PluginAPIBridgeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function usePluginAPIBridge(): PluginAPIBridgeContextValue {
  const context = useContext(PluginAPIBridgeContext);
  if (!context) {
    throw new Error(
      "usePluginAPIBridge must be used within PluginAPIBridgeProvider",
    );
  }
  return context;
}
