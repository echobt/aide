/**
 * AIAgentContext - Manages AI sub-agents
 * 
 * Handles:
 * - Agent spawning and lifecycle
 * - Agent task execution
 * - Agent status tracking
 */

import {
  createContext,
  useContext,
  onMount,
  onCleanup,
  ParentProps,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

import type { SubAgent, SubAgentStatus } from "../../types";

interface AgentStatusEvent {
  agentId: string;
  status: SubAgentStatus;
}

interface AIAgentState {
  agents: SubAgent[];
}

export interface AIAgentContextValue {
  agents: Accessor<SubAgent[]>;
  spawnAgent: (name: string, systemPrompt: string) => Promise<string>;
  runAgentTask: (agentId: string, prompt: string, context: string[]) => Promise<void>;
  cancelAgentTask: (taskId: string) => Promise<void>;
  fetchAgents: () => Promise<void>;
  getAgentById: (agentId: string) => SubAgent | undefined;
  _state: AIAgentState;
}

const AIAgentContext = createContext<AIAgentContextValue>();

export function AIAgentProvider(props: ParentProps) {
  const [state, setState] = createStore<AIAgentState>({
    agents: [],
  });

  const unlistenFns: UnlistenFn[] = [];

  const setupEventListeners = async () => {
    try {
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
    } catch (e) {
      console.error("[AIAgentContext] Failed to setup event listeners:", e);
    }
  };

  const fetchAgents = async () => {
    try {
      const agents = await invoke<SubAgent[]>("agent_list");
      setState("agents", agents);
    } catch (e) {
      console.error("[AIAgentContext] Failed to fetch agents:", e);
    }
  };

  const spawnAgent = async (name: string, systemPrompt: string): Promise<string> => {
    const agentId = await invoke<string>("agent_spawn", {
      name,
      systemPrompt,
      parentId: null,
    });

    await fetchAgents();

    return agentId;
  };

  const runAgentTask = async (agentId: string, prompt: string, context: string[]): Promise<void> => {
    setState(
      produce((s) => {
        const agent = s.agents.find((a) => a.id === agentId);
        if (agent) {
          agent.status = "running";
        }
      })
    );

    try {
      await invoke("agent_run_task", {
        agentId,
        prompt,
        context,
      });
    } catch (e) {
      setState(
        produce((s) => {
          const agent = s.agents.find((a) => a.id === agentId);
          if (agent) {
            agent.status = "failed";
          }
        })
      );
      throw e;
    }
  };

  const cancelAgentTask = async (taskId: string): Promise<void> => {
    await invoke("agent_cancel_task", { taskId });
  };

  const getAgentById = (agentId: string): SubAgent | undefined => {
    return state.agents.find((a) => a.id === agentId);
  };

  const agents: Accessor<SubAgent[]> = () => state.agents;

  onMount(async () => {
    await setupEventListeners();
  });

  onCleanup(() => {
    for (const unlisten of unlistenFns) {
      unlisten();
    }
    unlistenFns.length = 0;
  });

  const value: AIAgentContextValue = {
    agents,
    spawnAgent,
    runAgentTask,
    cancelAgentTask,
    fetchAgents,
    getAgentById,
    _state: state,
  };

  return (
    <AIAgentContext.Provider value={value}>
      {props.children}
    </AIAgentContext.Provider>
  );
}

export function useAIAgent() {
  const context = useContext(AIAgentContext);
  if (!context) {
    throw new Error("useAIAgent must be used within AIAgentProvider");
  }
  return context;
}
