/**
 * CortexAgentSidebar - Agent Factory Tree for Vibe mode
 * Shows hierarchical view of agents and their conversations
 */

import { Component, For, Show, JSX } from "solid-js";

export interface Conversation {
  id: string;
  title: string;
  status: "active" | "completed" | "error";
  changesCount?: number;
}

export interface Agent {
  id: string;
  name: string;
  branch: string;
  status: "running" | "idle" | "completed" | "error";
  conversations: Conversation[];
  isExpanded?: boolean;
}

export interface CortexAgentSidebarProps {
  projectName?: string;
  agents: Agent[];
  selectedConversationId?: string;
  onConversationSelect?: (agentId: string, conversationId: string) => void;
  onAgentToggle?: (agentId: string) => void;
  onNewWorkspace?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexAgentSidebar: Component<CortexAgentSidebarProps> = (props) => {
  const containerStyle = (): JSX.CSSProperties => ({
    width: "240px",
    height: "100%",
    background: "var(--cortex-bg-secondary)",
    "border-right": "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    ...props.style,
  });

  const headerStyle = (): JSX.CSSProperties => ({
    padding: "12px 16px",
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "border-bottom": "1px solid rgba(255,255,255,0.08)",
  });

  const projectIconStyle = (): JSX.CSSProperties => ({
    width: "20px",
    height: "20px",
    background: "var(--cortex-bg-primary)",
    "border-radius": "var(--cortex-radius-sm)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "font-size": "12px",
  });

  const projectNameStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "font-family": "'Inter', sans-serif",
    "font-size": "14px",
    "font-weight": "500",
    color: "var(--cortex-text-primary)",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  });

  const treeContainerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    overflow: "auto",
    padding: "8px 0",
  });

  const agentItemStyle = (isActive: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 16px",
    cursor: "pointer",
    background: isActive ? "rgba(178,255,34,0.1)" : "transparent",
    transition: "background 100ms",
  });

  const agentIconStyle = (status: Agent["status"]): JSX.CSSProperties => ({
    width: "18px",
    height: "18px",
    "border-radius": "var(--cortex-radius-sm)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "font-size": "10px",
    background: status === "running" ? "var(--cortex-accent-primary)" : 
                status === "error" ? "var(--cortex-error)" : 
                status === "completed" ? "var(--cortex-success)" : "var(--cortex-bg-primary)",
    color: status === "running" || status === "completed" ? "#000" : "#fff",
  });

  const agentNameStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "font-family": "'Inter', sans-serif",
    "font-size": "13px",
    color: "var(--cortex-text-primary)",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  });

  const branchBadgeStyle = (): JSX.CSSProperties => ({
    "font-family": "'JetBrains Mono', monospace",
    "font-size": "10px",
    color: "var(--cortex-text-inactive)",
    background: "var(--cortex-bg-primary)",
    padding: "2px 6px",
    "border-radius": "var(--cortex-radius-sm)",
  });

  const conversationItemStyle = (isSelected: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 16px 6px 40px",
    cursor: "pointer",
    background: isSelected ? "rgba(178,255,34,0.15)" : "transparent",
    "border-left": isSelected ? "2px solid var(--cortex-accent-primary)" : "2px solid transparent",
    transition: "all 100ms",
  });

  const conversationIconStyle = (status: Conversation["status"]): JSX.CSSProperties => ({
    width: "14px",
    height: "14px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "font-size": "10px",
    color: status === "error" ? "var(--cortex-error)" : 
           status === "completed" ? "var(--cortex-success)" : "var(--cortex-text-inactive)",
  });

  const conversationTitleStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "font-family": "'Inter', sans-serif",
    "font-size": "12px",
    color: "var(--cortex-text-secondary)",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  });

  const changesBadgeStyle = (): JSX.CSSProperties => ({
    "font-family": "'JetBrains Mono', monospace",
    "font-size": "10px",
    color: "var(--cortex-accent-primary)",
    background: "rgba(178,255,34,0.15)",
    padding: "1px 4px",
    "border-radius": "var(--cortex-radius-sm)",
  });

  const newWorkspaceStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 16px",
    cursor: "pointer",
    color: "var(--cortex-text-inactive)",
    "font-family": "'Inter', sans-serif",
    "font-size": "13px",
    transition: "color 100ms",
  });

  const chevronStyle = (isExpanded: boolean): JSX.CSSProperties => ({
    width: "12px",
    height: "12px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    transition: "transform 150ms",
    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
    color: "var(--cortex-text-inactive)",
  });

  return (
    <div class={props.class} style={containerStyle()}>
      {/* Header */}
      <div style={headerStyle()}>
        <div style={projectIconStyle()}>🏠</div>
        <span style={projectNameStyle()}>{props.projectName || "Home"}</span>
      </div>

      {/* Agent Tree */}
      <div style={treeContainerStyle()}>
        <For each={props.agents}>
          {(agent) => (
            <>
              {/* Agent Item */}
              <div
                style={agentItemStyle(false)}
                onClick={() => props.onAgentToggle?.(agent.id)}
                onMouseEnter={(e) => {
                  if (!agent.isExpanded) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!agent.isExpanded) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                <div style={chevronStyle(agent.isExpanded || false)}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                    <path d="M2 1L6 4L2 7V1Z" />
                  </svg>
                </div>
                <div style={agentIconStyle(agent.status)}>🤖</div>
                <span style={agentNameStyle()}>{agent.name}</span>
                <span style={branchBadgeStyle()}>{agent.branch}</span>
              </div>

              {/* Conversations */}
              <Show when={agent.isExpanded}>
                <For each={agent.conversations}>
                  {(conv) => (
                    <div
                      style={conversationItemStyle(props.selectedConversationId === conv.id)}
                      onClick={() => props.onConversationSelect?.(agent.id, conv.id)}
                      onMouseEnter={(e) => {
                        if (props.selectedConversationId !== conv.id) {
                          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (props.selectedConversationId !== conv.id) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                        }
                      }}
                    >
                      <div style={conversationIconStyle(conv.status)}>💬</div>
                      <span style={conversationTitleStyle()}>{conv.title}</span>
                      <Show when={conv.changesCount && conv.changesCount > 0}>
                        <span style={changesBadgeStyle()}>+{conv.changesCount}</span>
                      </Show>
                    </div>
                  )}
                </For>
              </Show>
            </>
          )}
        </For>

        {/* New Workspace Button */}
        <div
          style={newWorkspaceStyle()}
          onClick={props.onNewWorkspace}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-inactive)";
          }}
        >
          <span>+</span>
          <span>New workspace</span>
        </div>
      </div>
    </div>
  );
};

export default CortexAgentSidebar;


