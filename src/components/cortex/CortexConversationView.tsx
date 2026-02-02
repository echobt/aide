/**
 * CortexConversationView - Chat conversation view for Vibe mode
 * Shows messages with Conductor-style formatting
 */

import { Component, For, Show, createSignal, JSX } from "solid-js";
import { CortexPromptInput } from "./primitives/CortexInput";

export interface ToolCall {
  name: string;
  status: "running" | "completed" | "error";
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  toolCalls?: ToolCall[];
  isError?: boolean;
  codeBlocks?: { language: string; code: string }[];
}

export interface CortexConversationViewProps {
  conversationTitle?: string;
  branchName?: string;
  status?: "in_progress" | "ready_to_merge" | "merged" | "error";
  messages: Message[];
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onStop?: () => void;
  isProcessing?: boolean;
  modelName?: string;
  onMerge?: () => void;
  activeTab?: "all_changes" | "current_task" | "review";
  onTabChange?: (tab: "all_changes" | "current_task" | "review") => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexConversationView: Component<CortexConversationViewProps> = (props) => {
  const containerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    background: "var(--cortex-bg-secondary)",
    overflow: "hidden",
    ...props.style,
  });

  const [activeTab, setActiveTab] = createSignal(props.activeTab || "all_changes");

  // Header with tabs (Conductor style)
  const headerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    padding: "0 16px",
    height: "40px",
    "border-bottom": "1px solid rgba(255,255,255,0.08)",
    gap: "4px",
  });

  const tabStyle = (isActive: boolean): JSX.CSSProperties => ({
    padding: "8px 12px",
    "font-family": "'Inter', sans-serif",
    "font-size": "13px",
    color: isActive ? "var(--cortex-text-primary)" : "var(--cortex-text-inactive)",
    background: "transparent",
    border: "none",
    "border-bottom": isActive ? "2px solid var(--cortex-accent-primary)" : "2px solid transparent",
    cursor: "pointer",
    transition: "all 100ms",
    "margin-bottom": "-1px",
  });

  const addTabStyle = (): JSX.CSSProperties => ({
    padding: "8px",
    "font-size": "14px",
    color: "var(--cortex-text-inactive)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
  });

  const headerRightStyle = (): JSX.CSSProperties => ({
    "margin-left": "auto",
    display: "flex",
    "align-items": "center",
    gap: "8px",
  });

  const branchBadgeStyle = (): JSX.CSSProperties => ({
    "font-family": "'JetBrains Mono', monospace",
    "font-size": "11px",
    color: "var(--cortex-accent-primary)",
    background: "rgba(178,255,34,0.15)",
    padding: "3px 8px",
    "border-radius": "var(--cortex-radius-sm)",
  });

  const statusBadgeStyle = (status: CortexConversationViewProps["status"]): JSX.CSSProperties => ({
    "font-family": "'Inter', sans-serif",
    "font-size": "11px",
    padding: "4px 10px",
    "border-radius": "var(--cortex-radius-lg)",
    background: status === "ready_to_merge" ? "rgba(34,197,94,0.15)" :
                status === "merged" ? "rgba(59,130,246,0.15)" :
                status === "error" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
    color: status === "ready_to_merge" ? "var(--cortex-success)" :
           status === "merged" ? "var(--cortex-info)" :
           status === "error" ? "var(--cortex-error)" : "var(--cortex-text-inactive)",
  });

  const mergeButtonStyle = (): JSX.CSSProperties => ({
    padding: "6px 14px",
    background: "var(--cortex-success)",
    border: "none",
    "border-radius": "var(--cortex-radius-md)",
    "font-family": "'Inter', sans-serif",
    "font-size": "12px",
    "font-weight": "500",
    color: "var(--cortex-text-primary)",
    cursor: "pointer",
    display: "flex",
    "align-items": "center",
    gap: "6px",
    transition: "opacity 100ms",
  });

  const handleTabChange = (tab: "all_changes" | "current_task" | "review") => {
    setActiveTab(tab);
    props.onTabChange?.(tab);
  };

  const messagesContainerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    overflow: "auto",
    padding: "16px",
    display: "flex",
    "flex-direction": "column",
    gap: "12px",
  });

  const messageStyle = (role: Message["role"], isError?: boolean): JSX.CSSProperties => ({
    padding: "12px 16px",
    "border-radius": "var(--cortex-radius-md)",
    background: isError ? "rgba(239,68,68,0.1)" :
                role === "user" ? "var(--cortex-bg-primary)" :
                role === "assistant" ? "var(--cortex-bg-primary)" : "rgba(255,255,255,0.05)",
    border: isError ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.08)",
  });

  const messageContentStyle = (): JSX.CSSProperties => ({
    "font-family": "'Inter', sans-serif",
    "font-size": "14px",
    "line-height": "1.6",
    color: "var(--cortex-text-primary)",
    "white-space": "pre-wrap",
  });

  const toolCallsStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    background: "rgba(255,255,255,0.03)",
    "border-radius": "var(--cortex-radius-md)",
    "margin-top": "8px",
    "font-family": "'Inter', sans-serif",
    "font-size": "12px",
    color: "var(--cortex-text-inactive)",
    cursor: "pointer",
  });

  const codeBlockStyle = (): JSX.CSSProperties => ({
    background: "var(--cortex-bg-secondary)",
    "border-radius": "var(--cortex-radius-md)",
    padding: "12px",
    "margin-top": "8px",
    overflow: "auto",
  });

  const codeStyle = (): JSX.CSSProperties => ({
    "font-family": "'JetBrains Mono', monospace",
    "font-size": "12px",
    "line-height": "1.5",
    color: "var(--cortex-text-primary)",
    "white-space": "pre",
  });

  const codeHighlightStyle = (): JSX.CSSProperties => ({
    background: "rgba(178,255,34,0.2)",
    color: "var(--cortex-accent-primary)",
    padding: "1px 4px",
    "border-radius": "var(--cortex-radius-sm)",
    "font-family": "'JetBrains Mono', monospace",
  });

  const inputContainerStyle = (): JSX.CSSProperties => ({
    padding: "16px",
    "border-top": "1px solid rgba(255,255,255,0.08)",
  });

  const getStatusText = (status: CortexConversationViewProps["status"]) => {
    switch (status) {
      case "ready_to_merge": return "Ready to merge";
      case "merged": return "Merged";
      case "error": return "Error";
      default: return "In progress";
    }
  };

  const highlightCode = (content: string) => {
    // Simple code highlighting for inline code
    const parts = content.split(/(`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return <span style={codeHighlightStyle()}>{part.slice(1, -1)}</span>;
      }
      return part;
    });
  };

  return (
    <div class={props.class} style={containerStyle()}>
      {/* Header with Tabs (Conductor style) */}
      <div style={headerStyle()}>
        <button
          style={tabStyle(activeTab() === "all_changes")}
          onClick={() => handleTabChange("all_changes")}
        >
          All changes
        </button>
        <button
          style={tabStyle(activeTab() === "current_task")}
          onClick={() => handleTabChange("current_task")}
        >
          Current task
        </button>
        <button
          style={tabStyle(activeTab() === "review")}
          onClick={() => handleTabChange("review")}
        >
          Review
        </button>
        <button style={addTabStyle()}>+</button>

        {/* Right side: branch, status, merge */}
        <div style={headerRightStyle()}>
          <Show when={props.branchName}>
            <span style={branchBadgeStyle()}>{props.branchName}</span>
          </Show>
          <Show when={props.status}>
            <span style={statusBadgeStyle(props.status)}>{getStatusText(props.status)}</span>
          </Show>
          <Show when={props.status === "ready_to_merge" && props.onMerge}>
            <button
              style={mergeButtonStyle()}
              onClick={props.onMerge}
            >
              Merge
            </button>
          </Show>
        </div>
      </div>

      {/* Messages */}
      <div style={messagesContainerStyle()}>
        <For each={props.messages}>
          {(message) => (
            <div style={messageStyle(message.role, message.isError)}>
              <div style={messageContentStyle()}>
                {highlightCode(message.content)}
              </div>

              {/* Tool Calls */}
              <Show when={message.toolCalls && message.toolCalls.length > 0}>
                <div style={toolCallsStyle()}>
                  <span>▸</span>
                  <span>{message.toolCalls!.length} tool calls, {message.toolCalls!.filter(t => t.status === "completed").length} completed</span>
                </div>
              </Show>

              {/* Code Blocks */}
              <For each={message.codeBlocks}>
                {(block) => (
                  <div style={codeBlockStyle()}>
                    <code style={codeStyle()}>{block.code}</code>
                  </div>
                )}
              </For>
            </div>
          )}
        </For>
      </div>

      {/* Input */}
      <div style={inputContainerStyle()}>
        <CortexPromptInput
          value={props.inputValue}
          placeholder="Send a prompt or run a command..."
          onChange={props.onInputChange}
          onSubmit={props.onSubmit}
          onStop={props.onStop}
          isProcessing={props.isProcessing}
          modelName={props.modelName || "Claude 3.5 Sonnet"}
        />
      </div>
    </div>
  );
};

export default CortexConversationView;


