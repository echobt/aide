/**
 * CortexChatPanel - Pixel-perfect chat panel matching Figma design
 * 
 * 3 States:
 * 1. Home (Full Screen) - Logo + title + prompt input
 * 2. Minimized (Overlay) - 369×297px positioned bottom-left
 * 3. Agent Working (Expanded) - Messages with progress indicators
 */

import { Component, JSX, splitProps, Show, For } from "solid-js";
import { CortexIcon, CortexPromptInput } from "./primitives";

export type ChatPanelState = "home" | "minimized" | "expanded";

export interface ChatMessage {
  id: string;
  type: "user" | "agent";
  content: string;
  timestamp?: Date;
  actions?: ChatAction[];
  isThinking?: boolean;
  progress?: ChatProgress[];
}

export interface ChatAction {
  id: string;
  label: string;
  icon?: string;
  onClick?: () => void;
}

export interface ChatProgress {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "error";
}

export interface CortexChatPanelProps {
  state?: ChatPanelState;
  messages?: ChatMessage[];
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onStop?: () => void;
  isProcessing?: boolean;
  modelName?: string;
  modelIcon?: string;
  onModelClick?: () => void;
  onPlusClick?: () => void;
  onUploadClick?: () => void;
  onBuildClick?: () => void;
  onImportCodeClick?: () => void;
  onImportDesignClick?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

// Logo Component - Claude logo from Figma (no glow)
const AnimatedLogo: Component<{ size?: number }> = (props) => {
  const size = props.size || 120;
  
  return (
    <img 
      src="/assets/claude-logo.svg" 
      alt="Claude" 
      style={{ 
        width: `${size}px`, 
        height: `${size}px`, 
      }} 
    />
  );
};

export const CortexChatPanel: Component<CortexChatPanelProps> = (props) => {
  const [local] = splitProps(props, [
    "state",
    "messages",
    "inputValue",
    "onInputChange",
    "onSubmit",
    "onStop",
    "isProcessing",
    "modelName",
    "modelIcon",
    "onModelClick",
    "onPlusClick",
    "onUploadClick",
    "onBuildClick",
    "onImportCodeClick",
    "onImportDesignClick",
    "class",
    "style",
  ]);

  const state = () => local.state || "home";

  // Render based on state
  return (
    <Show
      when={state() === "home"}
      fallback={
        <Show
          when={state() === "minimized"}
          fallback={<ExpandedChat {...local} />}
        >
          <MinimizedChat {...local} />
        </Show>
      }
    >
      <HomeChat {...local} />
    </Show>
  );
};

/**
 * HomeChat - Full screen home state (Vibe mode)
 * Figma node: 0:140
 */
const HomeChat: Component<Omit<CortexChatPanelProps, "state" | "messages">> = (props) => {
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    width: "100%",
    height: "100%",
    background: "var(--cortex-bg-secondary)",
    gap: "8px",
    padding: "48px",
    position: "relative",
    overflow: "hidden",
    ...props.style,
  });

  // Title: Figma node 0:329 - 56px, white
  const titleStyle = (): JSX.CSSProperties => ({
    "font-family": "'Inter', sans-serif",
    "font-size": "56px",
    "font-weight": "400",
    "font-style": "normal",
    color: "var(--cortex-text-primary)",
    "text-align": "center",
    "line-height": "64px",
    "letter-spacing": "0px",
    "margin-top": "16px",
  });

  // Subtitle: Figma node 0:330 - 20px, var(--cortex-text-inactive)
  const subtitleStyle = (): JSX.CSSProperties => ({
    "font-family": "'Inter', sans-serif",
    "font-size": "20px",
    "font-weight": "400",
    color: "var(--cortex-text-inactive)",
    "text-align": "center",
    "line-height": "24px",
    "margin-bottom": "24px",
  });

  // Quick actions: Build, Import Code, Import Design
  const quickActionsStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "margin-top": "16px",
  });

  // Action button style
  const actionButtonStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "7px",
    height: "24px",
    padding: "0 8px",
    background: "var(--cortex-bg-primary)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    "border-radius": "var(--cortex-radius-md)",
    cursor: "pointer",
    "font-family": "'Inter', sans-serif",
    "font-size": "14px",
    color: "var(--cortex-text-primary)",
    "line-height": "16px",
  });

  return (
    <div class={props.class} style={containerStyle()}>
      {/* Animated Logo */}
      <AnimatedLogo size={120} />

      {/* Title */}
      <h1 style={titleStyle()}>What would you like to build</h1>

      {/* Subtitle */}
      <p style={subtitleStyle()}>Start a conversation or open a project</p>

      {/* Prompt Input */}
      <CortexPromptInput
        value={props.inputValue}
        placeholder="Send a prompt or run a command..."
        onChange={props.onInputChange}
        onSubmit={props.onSubmit}
        onStop={props.onStop}
        isProcessing={props.isProcessing}
        modelName={props.modelName}
        modelIcon={props.modelIcon}
        onModelClick={props.onModelClick}
        onPlusClick={props.onPlusClick}
        onUploadClick={props.onUploadClick}
      />

      {/* Quick Actions: Build, Import Code, Import Design - using Figma assets */}
      <div style={quickActionsStyle()}>
        <button style={actionButtonStyle()} onClick={props.onBuildClick}>
          <img src="/assets/brackets-square.svg" alt="" style={{ width: "16px", height: "16px" }} />
          <span>Build</span>
        </button>
        <button style={actionButtonStyle()} onClick={props.onImportCodeClick}>
          <img src="/assets/code.svg" alt="" style={{ width: "16px", height: "16px" }} />
          <span>Import Code</span>
        </button>
        <button style={actionButtonStyle()} onClick={props.onImportDesignClick}>
          <img src="/assets/palette.svg" alt="" style={{ width: "16px", height: "16px" }} />
          <span>Import Design</span>
        </button>
      </div>
    </div>
  );
};

/**
 * MinimizedChat - Bottom-left overlay (369×297px)
 */
const MinimizedChat: Component<Omit<CortexChatPanelProps, "state">> = (props) => {
  const containerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "8px",
    bottom: "36px", // Above status bar
    width: "369px",
    height: "297px",
    background: "var(--cortex-bg-primary)",
    "border-radius": "var(--cortex-radius-lg, 12px)",
    border: "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    display: "flex",
    "flex-direction": "column",
    padding: "12px",
    gap: "16px",
    "box-shadow": "var(--cortex-elevation-3, 0 8px 16px rgba(0,0,0,0.3))",
    ...props.style,
  });

  const titleContainerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    gap: "8px",
    padding: "8px",
  });

  const titleStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "24px",
    "font-weight": "400",
    "font-style": "italic",
    color: "var(--cortex-text-primary, var(--cortex-text-primary))",
    "line-height": "32px",
  });

  const subtitleStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    "line-height": "24px",
  });

  return (
    <div class={props.class} style={containerStyle()}>
      {/* Title Section */}
      <div style={titleContainerStyle()}>
        <h2 style={titleStyle()}>What would you like to build</h2>
        <p style={subtitleStyle()}>Start a conversation or open a project</p>
      </div>

      {/* Spacer */}
      <div style={{ flex: "1" }} />

      {/* Prompt Input */}
      <CortexPromptInput
        value={props.inputValue}
        placeholder="Send a prompt or run a command..."
        onChange={props.onInputChange}
        onSubmit={props.onSubmit}
        onStop={props.onStop}
        isProcessing={props.isProcessing}
        modelName={props.modelName}
        modelIcon={props.modelIcon}
        onModelClick={props.onModelClick}
        onPlusClick={props.onPlusClick}
        onUploadClick={props.onUploadClick}
        style={{ width: "100%" }}
      />
    </div>
  );
};

/**
 * ExpandedChat - Chat with messages (agent working state)
 */
const ExpandedChat: Component<Omit<CortexChatPanelProps, "state">> = (props) => {
  const containerStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "8px",
    bottom: "36px",
    width: "369px",
    "max-height": "calc(100vh - 120px)",
    background: "var(--cortex-bg-primary)",
    "border-radius": "var(--cortex-radius-lg, 12px)",
    border: "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    display: "flex",
    "flex-direction": "column",
    "box-shadow": "var(--cortex-elevation-3, 0 8px 16px rgba(0,0,0,0.3))",
    overflow: "hidden",
    ...props.style,
  });

  const messagesContainerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    "overflow-y": "auto",
    padding: "12px",
    display: "flex",
    "flex-direction": "column",
    gap: "16px",
  });

  const inputContainerStyle = (): JSX.CSSProperties => ({
    padding: "12px",
    "border-top": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
  });

  return (
    <div class={props.class} style={containerStyle()}>
      {/* Messages */}
      <div style={messagesContainerStyle()}>
        <For each={props.messages || []}>
          {(message) => <ChatMessageBubble message={message} />}
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
          modelName={props.modelName}
          modelIcon={props.modelIcon}
          onModelClick={props.onModelClick}
          onPlusClick={props.onPlusClick}
          onUploadClick={props.onUploadClick}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
};

/**
 * ChatMessageBubble - Individual message display
 */
interface ChatMessageBubbleProps {
  message: ChatMessage;
}

const ChatMessageBubble: Component<ChatMessageBubbleProps> = (props) => {
  const isUser = () => props.message.type === "user";

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    gap: "8px",
    padding: "12px",
    background: isUser()
      ? "var(--cortex-bg-tertiary, var(--cortex-bg-hover))"
      : "transparent",
    "border-radius": "var(--cortex-radius-md, 8px)",
  });

  const contentStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "14px",
    color: "var(--cortex-text-primary, var(--cortex-text-primary))",
    "line-height": "1.5",
    "white-space": "pre-wrap",
  });

  const thinkingStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "flex-start",
    gap: "8px",
    color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    "font-size": "14px",
  });

  const actionsStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "16px",
    "margin-top": "8px",
  });

  const actionLinkStyle = (): JSX.CSSProperties => ({
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "12px",
    color: "var(--cortex-accent-primary, var(--cortex-accent-primary))",
    cursor: "pointer",
    display: "flex",
    "align-items": "center",
    gap: "4px",
    background: "transparent",
    border: "none",
    padding: "0",
  });

  const progressItemStyle = (status: string): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "font-size": "12px",
    color: status === "completed"
      ? "var(--cortex-success, var(--cortex-success))"
      : status === "error"
      ? "var(--cortex-error, var(--cortex-error))"
      : "var(--cortex-text-muted, var(--cortex-text-inactive))",
  });

  return (
    <div style={containerStyle()}>
      {/* Thinking indicator */}
      <Show when={props.message.isThinking}>
        <div style={thinkingStyle()}>
          <CortexIcon name="star" size={16} color="var(--cortex-accent-primary, var(--cortex-accent-primary))" />
          <span>Thinking...</span>
        </div>
      </Show>

      {/* Content */}
      <p style={contentStyle()}>{props.message.content}</p>

      {/* Progress items */}
      <Show when={props.message.progress && props.message.progress.length > 0}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
          <For each={props.message.progress}>
            {(item) => (
              <div style={progressItemStyle(item.status)}>
                <CortexIcon
                  name={item.status === "completed" ? "check" : item.status === "error" ? "alert" : "star"}
                  size={14}
                />
                <span>{item.label}</span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Actions */}
      <Show when={props.message.actions && props.message.actions.length > 0}>
        <div style={actionsStyle()}>
          <For each={props.message.actions}>
            {(action) => (
              <button style={actionLinkStyle()} onClick={action.onClick}>
                <Show when={action.icon}>
                  <CortexIcon name={action.icon!} size={12} />
                </Show>
                {action.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default CortexChatPanel;


