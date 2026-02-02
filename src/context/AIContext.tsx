/**
 * AI Context Provider
 * Manages AI model interactions, threads, streaming, and sub-agents via Tauri IPC
 */

import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  batch,
  ParentProps,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { aiLogger } from "../utils/logger";

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_SELECTED_MODEL = "cortex_ai_selected_model";
const STORAGE_KEY_ACTIVE_THREAD = "cortex_ai_active_thread";

// ============================================================================
// Types - Re-exported from centralized types for backward compatibility
// ============================================================================

import type {
  AIModel,
  ToolCall,
  ToolResult,
  Message,
  AIMessage,
  Thread,
  SubAgent,
  StreamChunk,
  ToolParameter,
  ToolDefinition,
  FileContext,
  MessageContext,
} from "../types";

// Re-export types for backward compatibility with existing imports
export type {
  AIModel,
  ToolCall,
  ToolResult,
  Message,
  AIMessage,
  Thread,
  SubAgent,
  StreamChunk,
  ToolParameter,
  ToolDefinition,
  FileContext,
  MessageContext,
};

// ============================================================================
// Tauri Event Payloads
// ============================================================================

interface StreamChunkEvent {
  threadId: string;
  content: string;
  done: boolean;
}

interface ToolCallEvent {
  threadId: string;
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResultEvent {
  threadId: string;
  callId: string;
  output: string;
  success: boolean;
  durationMs?: number;
}

interface AgentStatusEvent {
  agentId: string;
  status: "idle" | "running" | "completed" | "failed";
}

interface ErrorEvent {
  code: string;
  message: string;
}

// ============================================================================
// Context Value Interface
// ============================================================================

export interface AIContextValue {
  // Models
  models: Accessor<AIModel[]>;
  selectedModel: Accessor<string>;
  setSelectedModel: (model: string) => void;

  // Threads
  threads: Accessor<Thread[]>;
  activeThread: Accessor<Thread | null>;
  createThread: () => Promise<Thread>;
  selectThread: (id: string) => void;
  deleteThread: (id: string) => Promise<void>;
  clearAllThreads: () => Promise<void>;

  // Messages
  sendMessage: (content: string, context?: MessageContext) => Promise<void>;
  isStreaming: Accessor<boolean>;
  streamingContent: Accessor<string>;
  cancelStream: () => void;

  // Sub-agents
  agents: Accessor<SubAgent[]>;
  spawnAgent: (name: string, systemPrompt: string) => Promise<string>;
  runAgentTask: (agentId: string, prompt: string, context: string[]) => Promise<void>;
  cancelAgentTask: (taskId: string) => Promise<void>;

  // Tools
  availableTools: Accessor<ToolDefinition[]>;
}

// ============================================================================
// State Interface
// ============================================================================

interface AIState {
  models: AIModel[];
  selectedModel: string;
  threads: Thread[];
  activeThreadId: string | null;
  agents: SubAgent[];
  tools: ToolDefinition[];
  isStreaming: boolean;
  streamingContent: string;
  currentStreamAbortController: AbortController | null;
}

// ============================================================================
// Context
// ============================================================================

const AIContext = createContext<AIContextValue>();

// ============================================================================
// Provider Component
// ============================================================================

export function AIProvider(props: ParentProps) {
  const [state, setState] = createStore<AIState>({
    models: [],
    selectedModel: "",
    threads: [],
    activeThreadId: null,
    agents: [],
    tools: [],
    isStreaming: false,
    streamingContent: "",
    currentStreamAbortController: null,
  });

  // Track event listeners for cleanup
  const unlistenFns: UnlistenFn[] = [];

  // Toast notifications (lazy import to avoid circular deps)
  let showToast: ((message: string, variant: "success" | "error" | "warning" | "info") => void) | null = null;

  const initToast = () => {
    if (!showToast) {
      try {
        const toastModule = (window as unknown as { __toastContext?: { error: (msg: string) => void; success: (msg: string) => void; warning: (msg: string) => void; info: (msg: string) => void } }).__toastContext;
        if (toastModule) {
          showToast = (message, variant) => {
            toastModule[variant]?.(message);
          };
        }
      } catch {
        // Toast not available, use console fallback
      }
    }
  };

  const notifyError = (message: string) => {
    initToast();
    if (showToast) {
      showToast(message, "error");
    } else {
      console.error("[AIContext]", message);
    }
  };

  const notifySuccess = (message: string) => {
    initToast();
    if (showToast) {
      showToast(message, "success");
    } else {
      aiLogger.debug(message);
    }
  };

  // ============================================================================
  // Initialization
  // ============================================================================

  const loadFromStorage = () => {
    try {
      const savedModel = localStorage.getItem(STORAGE_KEY_SELECTED_MODEL);
      if (savedModel) {
        setState("selectedModel", savedModel);
      }

      const savedThreadId = localStorage.getItem(STORAGE_KEY_ACTIVE_THREAD);
      if (savedThreadId) {
        setState("activeThreadId", savedThreadId);
      }
    } catch (e) {
      console.warn("[AIContext] Failed to load from storage:", e);
    }
  };

  const saveToStorage = () => {
    try {
      if (state.selectedModel) {
        localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, state.selectedModel);
      }
      if (state.activeThreadId) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_THREAD, state.activeThreadId);
      }
    } catch (e) {
      console.warn("[AIContext] Failed to save to storage:", e);
    }
  };

  const fetchModels = async () => {
    try {
      const models = await invoke<AIModel[]>("ai_list_models");
      setState("models", models);

      // Set default model if none selected
      if (!state.selectedModel && models.length > 0) {
        setState("selectedModel", models[0].id);
      }
    } catch (e) {
      console.error("[AIContext] Failed to fetch models:", e);
      notifyError("Failed to load AI models");
    }
  };

  const fetchThreads = async () => {
    try {
      const threads = await invoke<Thread[]>("ai_list_threads");
      setState("threads", threads);

      // Validate active thread still exists
      if (state.activeThreadId) {
        const exists = threads.some((t) => t.id === state.activeThreadId);
        if (!exists) {
          setState("activeThreadId", null);
        }
      }
    } catch (e) {
      console.error("[AIContext] Failed to fetch threads:", e);
      notifyError("Failed to load chat threads");
    }
  };

  const fetchTools = async () => {
    try {
      const tools = await invoke<ToolDefinition[]>("tools_list");
      setState("tools", tools);
    } catch (e) {
      console.error("[AIContext] Failed to fetch tools:", e);
    }
  };

  const fetchAgents = async () => {
    try {
      const agents = await invoke<SubAgent[]>("agent_list");
      setState("agents", agents);
    } catch (e) {
      console.error("[AIContext] Failed to fetch agents:", e);
    }
  };

  // ============================================================================
  // Event Listeners
  // ============================================================================

  const setupEventListeners = async () => {
    try {
      // Stream chunk events
      const unlistenStreamChunk = await listen<StreamChunkEvent>("ai:stream_chunk", (event) => {
        const { threadId, content, done } = event.payload;

        if (threadId !== state.activeThreadId) return;

        if (done) {
          batch(() => {
            // Finalize streaming message
            setState(
              produce((s) => {
                const thread = s.threads.find((t) => t.id === threadId);
                if (thread && thread.messages.length > 0) {
                  const lastMsg = thread.messages[thread.messages.length - 1];
                  if (lastMsg.role === "assistant") {
                    lastMsg.content = s.streamingContent;
                  }
                  thread.updatedAt = Date.now();
                }
              })
            );
            setState("isStreaming", false);
            setState("streamingContent", "");
            setState("currentStreamAbortController", null);
          });
        } else {
          setState("streamingContent", (prev) => prev + content);
        }
      });
      unlistenFns.push(unlistenStreamChunk);

      // Tool call events
      const unlistenToolCall = await listen<ToolCallEvent>("ai:tool_call", (event) => {
        const { threadId, callId, name, arguments: args } = event.payload;

        setState(
          produce((s) => {
            const thread = s.threads.find((t) => t.id === threadId);
            if (thread && thread.messages.length > 0) {
              const lastMsg = thread.messages[thread.messages.length - 1];
              if (lastMsg.role === "assistant") {
                if (!lastMsg.toolCalls) {
                  lastMsg.toolCalls = [];
                }
                lastMsg.toolCalls.push({
                  id: callId,
                  name,
                  arguments: args,
                  status: "running",
                });
              }
            }
          })
        );
      });
      unlistenFns.push(unlistenToolCall);

      // Tool result events
      const unlistenToolResult = await listen<ToolResultEvent>("ai:tool_result", (event) => {
        const { threadId, callId, output, success, durationMs } = event.payload;

        setState(
          produce((s) => {
            const thread = s.threads.find((t) => t.id === threadId);
            if (thread) {
              for (const msg of thread.messages) {
                if (msg.toolCalls) {
                  const toolCall = msg.toolCalls.find((tc) => tc.id === callId);
                  if (toolCall) {
                    toolCall.status = success ? "completed" : "failed";
                  }
                }
                if (!msg.toolResults) {
                  msg.toolResults = [];
                }
                const existingResult = msg.toolResults.find((tr) => tr.callId === callId);
                if (!existingResult) {
                  msg.toolResults.push({
                    callId,
                    output,
                    success,
                    durationMs,
                  });
                }
              }
            }
          })
        );
      });
      unlistenFns.push(unlistenToolResult);

      // Agent status events
      const unlistenAgentStatus = await listen<AgentStatusEvent>("ai:agent_status", (event) => {
        const { agentId, status } = event.payload;

        setState(
          produce((s) => {
            const agent = s.agents.find((a) => a.id === agentId);
            if (agent) {
              agent.status = status;
            }
          })
        );
      });
      unlistenFns.push(unlistenAgentStatus);

      // Error events
      const unlistenError = await listen<ErrorEvent>("ai:error", (event) => {
        const { message } = event.payload;
        notifyError(message);

        // Stop streaming on error
        if (state.isStreaming) {
          batch(() => {
            setState("isStreaming", false);
            setState("streamingContent", "");
            setState("currentStreamAbortController", null);
          });
        }
      });
      unlistenFns.push(unlistenError);
    } catch (e) {
      console.error("[AIContext] Failed to setup event listeners:", e);
    }
  };

  // ============================================================================
  // Model Operations
  // ============================================================================

  const setSelectedModel = (model: string) => {
    setState("selectedModel", model);
    saveToStorage();
  };

  // ============================================================================
  // Thread Operations
  // ============================================================================

  const createThread = async (): Promise<Thread> => {
    try {
      const selectedModelInfo = state.models.find(m => m.id === state.selectedModel);
      const thread = await invoke<Thread>("ai_create_thread", {
        modelId: state.selectedModel,
        provider: selectedModelInfo?.provider || "openai",
        title: "New Chat",
        systemPrompt: "You are a helpful coding assistant.",
      });

      setState(
        produce((s) => {
          s.threads.unshift(thread);
          s.activeThreadId = thread.id;
        })
      );
      saveToStorage();

      return thread;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create thread";
      notifyError(message);
      throw e;
    }
  };

  const selectThread = (id: string) => {
    const thread = state.threads.find((t) => t.id === id);
    if (thread) {
      setState("activeThreadId", id);
      saveToStorage();
    }
  };

  const deleteThread = async (id: string): Promise<void> => {
    try {
      await invoke("ai_delete_thread", { threadId: id });

      setState(
        produce((s) => {
          s.threads = s.threads.filter((t) => t.id !== id);
          if (s.activeThreadId === id) {
            s.activeThreadId = s.threads.length > 0 ? s.threads[0].id : null;
          }
        })
      );
      saveToStorage();

      notifySuccess("Thread deleted");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete thread";
      notifyError(message);
      throw e;
    }
  };

  const clearAllThreads = async (): Promise<void> => {
    try {
      // Delete all threads from backend
      const threadIds = state.threads.map((t) => t.id);
      await Promise.all(threadIds.map((id) => invoke("ai_delete_thread", { threadId: id })));

      // Clear local state
      batch(() => {
        setState("threads", []);
        setState("activeThreadId", null);
      });
      saveToStorage();

      notifySuccess("All threads cleared");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to clear threads";
      notifyError(message);
      throw e;
    }
  };

  // ============================================================================
  // Message Operations
  // ============================================================================

  const sendMessage = async (content: string, context?: MessageContext): Promise<void> => {
    if (state.isStreaming) {
      notifyError("Please wait for the current response to complete");
      return;
    }

    let threadId = state.activeThreadId;

    // Create new thread if none active
    if (!threadId) {
      const thread = await createThread();
      threadId = thread.id;
    }

    // Add user message to thread
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
    };

    // Add placeholder assistant message for streaming
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    batch(() => {
      setState(
        produce((s) => {
          const thread = s.threads.find((t) => t.id === threadId);
          if (thread) {
            thread.messages.push(userMessage);
            thread.messages.push(assistantMessage);
            thread.updatedAt = Date.now();
          }
        })
      );
      setState("isStreaming", true);
      setState("streamingContent", "");
    });

    // Create abort controller for cancellation
    const abortController = new AbortController();
    setState("currentStreamAbortController", abortController);

    try {
      const thread = state.threads.find(t => t.id === threadId);
      const selectedModelInfo = state.models.find(m => m.id === state.selectedModel);
      
      if (!thread) throw new Error("Thread not found");

      // Convert messages to backend format
      const messagesForBackend = thread.messages
        .filter(m => m.id !== assistantMessage.id) // Don't send the placeholder
        .map(m => ({
          id: m.id,
          role: m.role,
          content: [{ type: 'text', text: m.content }],
          timestamp: new Date(m.timestamp).toISOString(),
          metadata: {}
        }));

      // Add the user message to backend thread storage
      await invoke("ai_add_message", {
        threadId,
        message: messagesForBackend[messagesForBackend.length - 1]
      });

      // Start streaming
      await invoke("ai_stream", {
        messages: messagesForBackend,
        model: state.selectedModel,
        provider: selectedModelInfo?.provider || "openai",
        threadId: threadId,
      });
    } catch (e) {
      // Handle cancellation separately
      if (abortController.signal.aborted) {
        return;
      }

      const message = e instanceof Error ? e.message : "Failed to send message";
      notifyError(message);

      // Remove the placeholder assistant message on error
      setState(
        produce((s) => {
          const thread = s.threads.find((t) => t.id === threadId);
          if (thread) {
            thread.messages = thread.messages.filter((m) => m.id !== assistantMessage.id);
          }
        })
      );

      batch(() => {
        setState("isStreaming", false);
        setState("streamingContent", "");
        setState("currentStreamAbortController", null);
      });

      throw e;
    }
  };

  const cancelStream = () => {
    if (!state.isStreaming) return;

    const abortController = state.currentStreamAbortController;
    if (abortController) {
      abortController.abort();
    }

    // Notify backend to cancel
    // invoke("ai_cancel_stream", { threadId: state.activeThreadId }).catch((e) => {
    //   console.warn("[AIContext] Failed to cancel stream:", e);
    // });

    batch(() => {
      // Finalize partial content if any
      if (state.streamingContent) {
        setState(
          produce((s) => {
            const thread = s.threads.find((t) => t.id === s.activeThreadId);
            if (thread && thread.messages.length > 0) {
              const lastMsg = thread.messages[thread.messages.length - 1];
              if (lastMsg.role === "assistant") {
                lastMsg.content = s.streamingContent + " [cancelled]";
              }
            }
          })
        );
      }
      setState("isStreaming", false);
      setState("streamingContent", "");
      setState("currentStreamAbortController", null);
    });
  };

  // ============================================================================
  // Sub-Agent Operations
  // ============================================================================

  const spawnAgent = async (name: string, systemPrompt: string): Promise<string> => {
    try {
      const agentId = await invoke<string>("agent_spawn", {
        name,
        systemPrompt,
        parentId: null,
      });

      // Fetch updated agent list
      await fetchAgents();

      return agentId;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to spawn agent";
      notifyError(message);
      throw e;
    }
  };

  const runAgentTask = async (agentId: string, prompt: string, context: string[]): Promise<void> => {
    try {
      // Update agent status
      setState(
        produce((s) => {
          const agent = s.agents.find((a) => a.id === agentId);
          if (agent) {
            agent.status = "running";
          }
        })
      );

      await invoke("agent_run_task", {
        agentId,
        prompt,
        context,
      });
    } catch (e) {
      // Update status to failed
      setState(
        produce((s) => {
          const agent = s.agents.find((a) => a.id === agentId);
          if (agent) {
            agent.status = "failed";
          }
        })
      );

      const message = e instanceof Error ? e.message : "Agent task failed";
      notifyError(message);
      throw e;
    }
  };

  const cancelAgentTask = async (taskId: string): Promise<void> => {
    try {
      await invoke("agent_cancel_task", { taskId });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to cancel agent task";
      notifyError(message);
      throw e;
    }
  };

  // ============================================================================
  // Accessors (for reactive reads)
  // ============================================================================

  const models: Accessor<AIModel[]> = () => state.models;
  const selectedModel: Accessor<string> = () => state.selectedModel;
  const threads: Accessor<Thread[]> = () => state.threads;
  const activeThread: Accessor<Thread | null> = () => {
    if (!state.activeThreadId) return null;
    return state.threads.find((t) => t.id === state.activeThreadId) ?? null;
  };
  const isStreaming: Accessor<boolean> = () => state.isStreaming;
  const streamingContent: Accessor<string> = () => state.streamingContent;
  const agents: Accessor<SubAgent[]> = () => state.agents;
  const availableTools: Accessor<ToolDefinition[]> = () => state.tools;

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: AIContextValue = {
    // Models
    models,
    selectedModel,
    setSelectedModel,

    // Threads
    threads,
    activeThread,
    createThread,
    selectThread,
    deleteThread,
    clearAllThreads,

    // Messages
    sendMessage,
    isStreaming,
    streamingContent,
    cancelStream,

    // Sub-agents
    agents,
    spawnAgent,
    runAgentTask,
    cancelAgentTask,

    // Tools
    availableTools,
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(async () => {
    loadFromStorage();

    // Setup event listeners first
    await setupEventListeners();

    // DEFERRED: Don't fetch data at startup - load on demand when user opens AI panel
    // This saves ~1s of startup time by avoiding 4 parallel IPC calls
    // Data will be fetched when ensureDataLoaded() is called
  });

  onCleanup(() => {
    // Cancel any active stream
    if (state.isStreaming) {
      cancelStream();
    }

    // Clean up event listeners
    for (const unlisten of unlistenFns) {
      unlisten();
    }
    unlistenFns.length = 0;
  });

  return <AIContext.Provider value={contextValue}>{props.children}</AIContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) {
    throw new Error("useAI must be used within AIProvider");
  }
  return ctx;
}
