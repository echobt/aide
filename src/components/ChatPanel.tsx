/**
 * ChatPanel - AI Chat panel for AuxiliaryBar
 * 
 * Provides inline AI chat functionality in the secondary sidebar.
 * Integrates with the existing AI/LLM context for conversations.
 */

import { createSignal, createEffect, For, Show, JSX } from "solid-js";
import { Icon } from "./ui/Icon";
import { IconButton, Text, Card, ContextMenu, ContextMenuPresets, type ContextMenuSection } from "@/components/ui";

// ============================================================================
// CSS Variable-based Color Palette
// ============================================================================
const palette = {
  canvas: "var(--surface-base)",
  panel: "var(--surface-card)",
  inputCard: "var(--surface-input)",
  border: "var(--border-default)",
  borderSubtle: "var(--border-default)",
  borderHover: "var(--border-hover)",
  textTitle: "var(--text-title)",
  textBody: "var(--text-primary)",
  textMuted: "var(--text-muted)",
  accent: "var(--text-placeholder)",
};

// ============================================================================
// NeonGridLoader Component - 3x3 Neon Grid with Snake Animation
// ============================================================================
function getSnakeDelay(index: number): number {
  const snakeOrder = [0, 1, 2, 5, 4, 3, 6, 7, 8];
  return snakeOrder.indexOf(index) * 100;
}

const neonGridStyles = {
  grid: {
    display: "grid",
    "grid-template-columns": "repeat(3, 1fr)",
    gap: "4px",
    width: "36px",
    height: "36px",
  } as const,
  
  cellBase: {
    width: "10px",
    height: "10px",
    "border-radius": "var(--cortex-radius-sm)",
    background: "var(--neon-color)",
    opacity: "0.3",
    "box-shadow": "0 0 8px var(--neon-glow), 0 0 12px var(--neon-glow)",
    animation: "neonPulse 1.2s ease-in-out infinite",
  } as const,
};

function NeonGridLoader() {
  const glowColor = "var(--neon-glow)";
  
  return (
    <div style={neonGridStyles.grid}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          style={{
            ...neonGridStyles.cellBase,
            "animation-delay": `${getSnakeDelay(i)}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes neonPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1); box-shadow: 0 0 12px ${glowColor}, 0 0 20px ${glowColor}, 0 0 30px ${glowColor}; }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// ============================================================================
// Panel Styles (extracted to module level to avoid recreation on each render)
// ============================================================================

const panelStyle: JSX.CSSProperties = {
  background: palette.canvas,
  height: "100%",
  display: "flex",
  "flex-direction": "column",
};

const headerStyle: JSX.CSSProperties = {
  padding: "12px 16px",
  "border-bottom": `1px solid ${palette.borderHover}`,
  color: palette.textTitle,
  "font-weight": "600",
};

const messagesContainerStyle: JSX.CSSProperties = {
  flex: "1",
  overflow: "auto",
  padding: "16px",
};

const styles = {
  // Header styles
  headerContainer: {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
  } as const,
  
  headerLeft: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  } as const,
  
  headerRight: {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  } as const,
  
  // Empty state styles
  emptyState: {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    height: "100%",
    "text-align": "center",
    color: palette.textMuted,
  } as const,
  
  // Messages list styles
  messagesList: {
    display: "flex",
    "flex-direction": "column",
    gap: "12px",
  } as const,
  
  // Message content wrapper
  messageContent: {
    flex: "1",
    "max-width": "85%",
  } as const,
  
  // Message text styles
  messageText: {
    "white-space": "pre-wrap",
    "word-break": "break-word",
    color: palette.textBody,
  } as const,
  
  // Loading indicator styles
  loadingContainer: {
    display: "flex",
    "align-items": "center",
    gap: "12px",
  } as const,
  
  // Input area styles
  inputArea: {
    padding: "16px",
    "border-top": `1px solid ${palette.borderHover}`,
  } as const,
  
  inputContainer: {
    display: "flex",
    gap: "8px",
    "align-items": "flex-end",
  } as const,
  
  textarea: {
    flex: "1",
    padding: "8px 12px",
    background: "var(--surface-input)",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--cortex-radius-lg)",
    color: "var(--text-primary)",
    "font-size": "14px",
    "font-family": "inherit",
    resize: "none",
    outline: "none",
    transition: "border-color 150ms ease",
  } as const,
  
  // Icon styles
  headerIcon: {
    width: "14px",
    height: "14px",
    color: palette.accent,
  } as const,
  
  clearIcon: {
    width: "12px",
    height: "12px",
    color: palette.textMuted,
  } as const,
  
  emptyIcon: {
    width: "32px",
    height: "32px",
    opacity: "0.5",
    color: palette.textMuted,
  } as const,
  
  smallIcon: {
    width: "12px",
    height: "12px",
  } as const,
  
  sendIcon: {
    width: "14px",
    height: "14px",
  } as const,
  
  // Avatar base styles
  avatarBase: {
    width: "24px",
    height: "24px",
    "border-radius": "var(--cortex-radius-full)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "flex-shrink": "0",
  } as const,
  
  // Card styles
  userCard: {
    background: "var(--surface-input)",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--cortex-radius-lg)",
  } as const,
  
  assistantCard: {
    background: "var(--surface-card)",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--cortex-radius-lg)",
  } as const,
  
  errorCard: {
    "margin-top": "12px",
    background: "var(--state-error-bg, rgba(220, 53, 69, 0.1))",
    border: "1px solid var(--state-error-muted, rgba(220, 53, 69, 0.3))",
    "border-radius": "var(--cortex-radius-md)",
  } as const,
};

// ============================================================================
// Main Component
// ============================================================================

export function ChatPanel() {
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [inputValue, setInputValue] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = createSignal<{
    visible: boolean;
    x: number;
    y: number;
    message: ChatMessage | null; // null = clicked on empty area
  }>({ visible: false, x: 0, y: 0, message: null });
  
  let inputRef: HTMLTextAreaElement | undefined;
  let messagesRef: HTMLDivElement | undefined;
  
  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    const msgs = messages();
    if (msgs.length > 0 && messagesRef) {
      setTimeout(() => {
        messagesRef?.scrollTo({ top: messagesRef.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  });
  
  // Handle send message
  const handleSend = async () => {
    const content = inputValue().trim();
    if (!content || isLoading()) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);
    
    try {
      // Dispatch event for AI context to handle
      const response = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Response timeout"));
        }, 30000);
        
        const handleResponse = (e: CustomEvent<{ content: string }>) => {
          clearTimeout(timeout);
          window.removeEventListener("chat:response", handleResponse as EventListener);
          resolve(e.detail.content);
        };
        
        window.addEventListener("chat:response", handleResponse as EventListener);
        
        window.dispatchEvent(new CustomEvent("chat:send", {
          detail: { content, context: "auxiliary-bar" }
        }));
      });
      
      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      // Fallback: show placeholder response
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "I'm the AI assistant. This chat panel is a placeholder - connect it to your AI backend for full functionality.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle key press
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Clear chat
  const handleClear = () => {
    setMessages([]);
    setError(null);
  };
  
  // Context menu handlers
  const handleMessageContextMenu = (e: MouseEvent, message: ChatMessage) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, message });
  };
  
  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };
  
  const handleCopyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };
  
  const handleDeleteMessage = (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };
  
  const handleRegenerateResponse = async (messageId: string) => {
    // Find the message and the user message before it
    const msgs = messages();
    const msgIndex = msgs.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    
    // Find the previous user message
    let userMessageIndex = msgIndex - 1;
    while (userMessageIndex >= 0 && msgs[userMessageIndex].role !== "user") {
      userMessageIndex--;
    }
    
    if (userMessageIndex < 0) return;
    
    const userMessage = msgs[userMessageIndex];
    
    // Remove all messages from the assistant message onwards
    setMessages(prev => prev.slice(0, msgIndex));
    
    // Re-send the user message
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Response timeout")), 30000);
        
        const handleResponse = (e: CustomEvent<{ content: string }>) => {
          clearTimeout(timeout);
          window.removeEventListener("chat:response", handleResponse as EventListener);
          resolve(e.detail.content);
        };
        
        window.addEventListener("chat:response", handleResponse as EventListener);
        window.dispatchEvent(new CustomEvent("chat:send", {
          detail: { content: userMessage.content, context: "auxiliary-bar" }
        }));
      });
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "I'm the AI assistant. This chat panel is a placeholder - connect it to your AI backend for full functionality.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExportChat = () => {
    const msgs = messages();
    if (msgs.length === 0) return;
    
    const exportData = msgs.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp).toISOString(),
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Build context menu sections based on what was clicked
  const getContextMenuSections = (): ContextMenuSection[] => {
    const ctx = contextMenu();
    
    if (ctx.message) {
      // Clicked on a message
      return ContextMenuPresets.chatMessageItems({
        isUserMessage: ctx.message.role === "user",
        hasCodeBlock: ctx.message.content.includes("```"),
        onCopyMessage: () => {
          handleCopyMessage(ctx.message!);
          closeContextMenu();
        },
        onCopyCodeBlock: () => {
          // Extract first code block
          const codeMatch = ctx.message!.content.match(/```[\s\S]*?\n([\s\S]*?)```/);
          if (codeMatch) {
            navigator.clipboard.writeText(codeMatch[1].trim());
          }
          closeContextMenu();
        },
        onRegenerate: () => {
          handleRegenerateResponse(ctx.message!.id);
          closeContextMenu();
        },
        onEdit: () => {
          // Set input to the message content for editing
          setInputValue(ctx.message!.content);
          handleDeleteMessage(ctx.message!.id);
          inputRef?.focus();
          closeContextMenu();
        },
        onDelete: () => {
          handleDeleteMessage(ctx.message!.id);
          closeContextMenu();
        },
      });
    } else {
      // Clicked on empty area
      return ContextMenuPresets.chatEmptyItems({
        onClearConversation: () => {
          handleClear();
          closeContextMenu();
        },
        onExportChat: () => {
          handleExportChat();
          closeContextMenu();
        },
        onSettings: () => {
          window.dispatchEvent(new CustomEvent("open-settings", { detail: { section: "ai" } }));
          closeContextMenu();
        },
      });
    }
  };
  
  // Format timestamp
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };
  
  return (
    <div
      class="chat-panel"
      style={panelStyle}
    >
      {/* Header */}
      <div
        class="chat-panel-header"
        style={{ ...styles.headerContainer, ...headerStyle }}
      >
        <div style={styles.headerLeft}>
          <Icon name="message" style={styles.headerIcon} />
          <Text size="sm" weight="medium" style={{ color: palette.textTitle }}>AI Chat</Text>
        </div>
        
        <div style={styles.headerRight}>
          <Show when={messages().length > 0}>
            <IconButton
              size="sm"
              tooltip="Clear Chat"
              onClick={handleClear}
            >
              <Icon name="trash" style={styles.clearIcon} />
            </IconButton>
          </Show>
        </div>
      </div>
      
      {/* Messages */}
      <div
        ref={messagesRef}
        class="chat-panel-messages"
        style={messagesContainerStyle}
        onContextMenu={(e) => {
          // Only show empty area menu if not clicking on a message
          if (!(e.target as HTMLElement).closest(".chat-message")) {
            e.preventDefault();
            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, message: null });
          }
        }}
      >
        <Show
          when={messages().length > 0}
          fallback={
            <div style={styles.emptyState}>
              <Icon name="message" style={styles.emptyIcon} />
              <Text variant="muted" size="sm" style={{ "margin-top": "12px", color: palette.textMuted }}>
                Ask a question about your code
              </Text>
              <Text variant="muted" size="xs" style={{ "margin-top": "4px", color: palette.textMuted }}>
                Shift+Enter for new line
              </Text>
            </div>
          }
        >
          <div style={styles.messagesList}>
            <For each={messages()}>
              {(message) => (
                <div
                  class="chat-message"
                  style={{
                    display: "flex",
                    gap: "8px",
                    "flex-direction": message.role === "user" ? "row-reverse" : "row",
                  }}
                  onContextMenu={(e) => handleMessageContextMenu(e, message)}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      ...styles.avatarBase,
                      background: message.role === "user" 
                        ? palette.accent 
                        : palette.panel,
                      color: message.role === "user" 
                        ? "var(--text-title)" 
                        : palette.accent,
                    }}
                  >
                    {message.role === "user" 
                      ? <Icon name="user" style={styles.smallIcon} />
                      : <Icon name="microchip" style={styles.smallIcon} />
                    }
                  </div>
                  
                  {/* Content */}
                  <div style={styles.messageContent}>
                    <Card
                      variant="default"
                      padding="sm"
                      style={message.role === "user" ? styles.userCard : styles.assistantCard}
                    >
                      <Text size="sm" style={styles.messageText}>
                        {message.content}
                      </Text>
                    </Card>
                    <Text
                      variant="muted"
                      size="xs"
                      style={{
                        "margin-top": "4px",
                        "text-align": message.role === "user" ? "right" : "left",
                        color: palette.textMuted,
                      }}
                    >
                      {formatTime(message.timestamp)}
                    </Text>
                  </div>
                </div>
              )}
            </For>
            
            {/* Loading indicator - NeonGridLoader */}
            <Show when={isLoading()}>
              <div style={styles.loadingContainer}>
                <div
                  style={{
                    ...styles.avatarBase,
                    background: palette.panel,
                    color: palette.accent,
                  }}
                >
                  <Icon name="microchip" style={styles.smallIcon} />
                </div>
                <NeonGridLoader />
                <Text variant="muted" size="xs" style={{ color: palette.textMuted }}>Thinking...</Text>
              </div>
            </Show>
          </div>
        </Show>
        
        {/* Error */}
        <Show when={error()}>
            <Card
              variant="default"
              padding="sm"
              style={styles.errorCard}
            >
              <Text size="xs" style={{ color: "var(--state-error)" }}>
                {error()}
              </Text>
            </Card>
        </Show>
      </div>
      
      {/* Input */}
      <div
        class="chat-panel-input"
        style={styles.inputArea}
      >
        <div style={styles.inputContainer}>
          <textarea
            ref={inputRef}
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about your code..."
            disabled={isLoading()}
            rows={2}
            style={styles.textarea}
            onFocus={(e) => {
              e.currentTarget.style.border = "2px solid var(--border-focus)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "1px solid var(--border-default)";
            }}
          />
          <IconButton
            size="md"
            tooltip="Send (Enter)"
            onClick={handleSend}
            disabled={!inputValue().trim() || isLoading()}
            style={{
              background: "var(--text-placeholder)",
              color: "var(--text-title)",
              opacity: (!inputValue().trim() || isLoading()) ? "0.5" : "1",
              "border-radius": "var(--cortex-radius-lg)",
            }}
          >
            <Icon name="paper-plane" style={styles.sendIcon} />
          </IconButton>
        </div>
      </div>
      
      {/* JetBrains-style Context Menu */}
      <ContextMenu
        state={{
          visible: contextMenu().visible,
          x: contextMenu().x,
          y: contextMenu().y,
          sections: getContextMenuSections(),
        }}
        onClose={closeContextMenu}
      />
      
      {/* Placeholder style */}
      <style>{`
        .chat-panel-input textarea::placeholder {
          color: var(--text-placeholder);
        }
      `}</style>
    </div>
  );
}

export default ChatPanel;

