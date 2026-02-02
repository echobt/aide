import { 
  Show, 
  For, 
  createSignal, 
  createEffect, 
  onMount, 
  onCleanup,
  createMemo
} from "solid-js";
import { Icon } from "./ui/Icon";
import { 
  useOutput, 
  OutputLine
} from "@/context/OutputContext";
import { LogLevelSelector } from "@/components/LogLevelSelector";

const MIN_PANEL_HEIGHT = 120;
const MAX_PANEL_HEIGHT = 800;
const DEFAULT_PANEL_HEIGHT = 280;

/**
 * ANSI color code mapping for terminal output rendering
 */
const ANSI_COLORS: Record<string, string> = {
  "30": "var(--cortex-bg-primary)",
  "31": "var(--cortex-error)",
  "32": "var(--cortex-syntax-comment)",
  "33": "var(--cortex-syntax-function)",
  "34": "var(--cortex-syntax-keyword)",
  "35": "var(--cortex-syntax-keyword)",
  "36": "var(--cortex-syntax-function)",
  "37": "var(--cortex-text-primary)",
  "90": "var(--cortex-text-inactive)",
  "91": "var(--cortex-error)",
  "92": "var(--cortex-syntax-comment)",
  "93": "var(--cortex-syntax-function)",
  "94": "var(--cortex-syntax-keyword)",
  "95": "var(--cortex-syntax-keyword)",
  "96": "var(--cortex-syntax-function)",
  "97": "var(--cortex-text-primary)",
};

const ANSI_BG_COLORS: Record<string, string> = {
  "40": "var(--cortex-bg-primary)",
  "41": "var(--cortex-error)",
  "42": "var(--cortex-syntax-comment)",
  "43": "var(--cortex-syntax-function)",
  "44": "var(--cortex-syntax-keyword)",
  "45": "var(--cortex-syntax-keyword)",
  "46": "var(--cortex-syntax-function)",
  "47": "var(--cortex-text-primary)",
  "100": "var(--cortex-text-inactive)",
  "101": "var(--cortex-error)",
  "102": "var(--cortex-syntax-comment)",
  "103": "var(--cortex-syntax-function)",
  "104": "var(--cortex-syntax-keyword)",
  "105": "var(--cortex-syntax-keyword)",
  "106": "var(--cortex-syntax-function)",
  "107": "var(--cortex-text-primary)",
};

interface AnsiSpan {
  text: string;
  style: {
    color?: string;
    backgroundColor?: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
  };
}

/**
 * Parse ANSI escape codes and return styled spans
 */
function parseAnsiCodes(text: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  
  let lastIndex = 0;
  let currentStyle: AnsiSpan["style"] = {};
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      spans.push({
        text: text.slice(lastIndex, match.index),
        style: { ...currentStyle },
      });
    }

    const codes = match[1].split(";").filter(Boolean);
    
    for (const code of codes) {
      if (code === "0" || code === "") {
        currentStyle = {};
      } else if (code === "1") {
        currentStyle.fontWeight = "bold";
      } else if (code === "3") {
        currentStyle.fontStyle = "italic";
      } else if (code === "4") {
        currentStyle.textDecoration = "underline";
      } else if (code === "22") {
        currentStyle.fontWeight = undefined;
      } else if (code === "23") {
        currentStyle.fontStyle = undefined;
      } else if (code === "24") {
        currentStyle.textDecoration = undefined;
      } else if (ANSI_COLORS[code]) {
        currentStyle.color = ANSI_COLORS[code];
      } else if (ANSI_BG_COLORS[code]) {
        currentStyle.backgroundColor = ANSI_BG_COLORS[code];
      } else if (code === "39") {
        currentStyle.color = undefined;
      } else if (code === "49") {
        currentStyle.backgroundColor = undefined;
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    spans.push({
      text: text.slice(lastIndex),
      style: { ...currentStyle },
    });
  }

  if (spans.length === 0 && text.length > 0) {
    spans.push({ text, style: {} });
  }

  return spans;
}

/**
 * Get severity color for a line
 */
function getSeverityColor(severity?: OutputLine["severity"]): string | undefined {
  switch (severity) {
    case "error":
      return "var(--cortex-error)";
    case "warning":
      return "var(--cortex-syntax-function)";
    case "success":
      return "var(--cortex-syntax-comment)";
    case "info":
      return "var(--cortex-syntax-keyword)";
    default:
      return undefined;
  }
}

/**
 * Render a single output line with ANSI color support
 */
function OutputLineRenderer(props: { line: OutputLine; wordWrap: boolean }) {
  const spans = createMemo(() => parseAnsiCodes(props.line.text));
  const severityColor = createMemo(() => getSeverityColor(props.line.severity));

  return (
    <div
      style={{
        "white-space": props.wordWrap ? "pre-wrap" : "pre",
        "word-break": props.wordWrap ? "break-all" : "normal",
        "padding": "1px 8px",
        "line-height": "1.4",
        color: severityColor() ?? "inherit",
      }}
    >
      <For each={spans()}>
        {(span) => (
          <span
            style={{
              color: span.style.color,
              "background-color": span.style.backgroundColor,
              "font-weight": span.style.fontWeight,
              "font-style": span.style.fontStyle,
              "text-decoration": span.style.textDecoration,
            }}
          >
            {span.text}
          </span>
        )}
      </For>
    </div>
  );
}

export interface OutputPanelProps {
  /** Whether the panel is visible */
  visible?: boolean;
  /** Callback when panel is closed */
  onClose?: () => void;
  /** Initial channel to display */
  initialChannel?: string;
}

/**
 * Output Panel component displaying output channels with ANSI color support
 */
export function OutputPanel(props: OutputPanelProps) {
  const output = useOutput();
  
  const [panelHeight, setPanelHeight] = createSignal(DEFAULT_PANEL_HEIGHT);
  const [isResizing, setIsResizing] = createSignal(false);
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [scrollLocked, setScrollLocked] = createSignal(false);
  const [wordWrap, setWordWrap] = createSignal(true);
  const [showDropdown, setShowDropdown] = createSignal(false);
  
  let panelRef: HTMLDivElement | undefined;
  let outputRef: HTMLDivElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;
  let previousHeight = DEFAULT_PANEL_HEIGHT;

  const activeChannel = createMemo(() => {
    const name = output.state.activeChannel;
    if (!name) return null;
    return output.getChannel(name);
  });

  const channelNames = createMemo(() => output.getChannelNames());

  const lines = createMemo(() => {
    const channel = activeChannel();
    if (!channel) return [];
    // Use filtered lines based on log level settings
    return output.getFilteredLines(channel.name);
  });

  const scrollToBottom = () => {
    if (outputRef && !scrollLocked()) {
      outputRef.scrollTop = outputRef.scrollHeight;
    }
  };

  createEffect(() => {
    // Track lines length to trigger scroll on new content
    lines().length;
    requestAnimationFrame(scrollToBottom);
  });

  createEffect(() => {
    if (props.initialChannel && !output.state.activeChannel) {
      output.setActiveChannel(props.initialChannel);
    }
  });

  onMount(() => {
    if (!output.state.activeChannel && channelNames().length > 0) {
      output.setActiveChannel(channelNames()[0]);
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    
    // Keyboard shortcut for scroll lock toggle (Ctrl+Shift+L)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "L") {
        e.preventDefault();
        const newLocked = !scrollLocked();
        setScrollLocked(newLocked);
        // If unlocking, scroll to bottom
        if (!newLocked) {
          scrollToBottom();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  const handleResizeStart = (e: MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startHeight = panelHeight();

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.min(
        MAX_PANEL_HEIGHT,
        Math.max(MIN_PANEL_HEIGHT, startHeight + delta)
      );
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const toggleMaximize = () => {
    if (isMaximized()) {
      setPanelHeight(previousHeight);
      setIsMaximized(false);
    } else {
      previousHeight = panelHeight();
      setPanelHeight(MAX_PANEL_HEIGHT);
      setIsMaximized(true);
    }
  };

  const handleClear = () => {
    const channel = output.state.activeChannel;
    if (channel) {
      output.clear(channel);
    }
  };

  const handleCopy = async () => {
    const channel = activeChannel();
    if (!channel) return;
    
    const text = channel.lines
      .map((line) => line.text.replace(/\x1b\[[0-9;]*m/g, ""))
      .join("\n");
    
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy output:", err);
    }
  };

  const handleSelectChannel = (name: string) => {
    output.setActiveChannel(name);
    setShowDropdown(false);
  };

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = Math.abs(
      target.scrollHeight - target.scrollTop - target.clientHeight
    ) < 5;
    
    // Auto-lock when user scrolls away from bottom
    if (!scrollLocked() && !isAtBottom) {
      setScrollLocked(true);
    }
    
    // Auto-unlock when user scrolls to bottom
    if (scrollLocked() && isAtBottom) {
      setScrollLocked(false);
    }
  };

  const handleClose = () => {
    props.onClose?.();
    output.hide();
  };

  return (
    <Show when={props.visible !== false}>
      <div
        ref={panelRef}
        style={{
          display: "flex",
          "flex-direction": "column",
          height: isMaximized() ? "100%" : `${panelHeight()}px`,
          "min-height": `${MIN_PANEL_HEIGHT}px`,
          "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
          "border-top": "1px solid var(--border, #333)",
          "font-family": "var(--font-mono, 'Consolas', 'Monaco', monospace)",
          "font-size": "12px",
          overflow: "hidden",
        }}
      >
        {/* Resize Handle */}
        <div
          style={{
            height: "4px",
            cursor: "ns-resize",
            "background-color": isResizing() ? "var(--accent, var(--cortex-info))" : "transparent",
            transition: "background-color 0.15s ease",
          }}
          onMouseDown={handleResizeStart}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = "var(--border-active, #444)";
          }}
          onMouseLeave={(e) => {
            if (!isResizing()) {
              (e.target as HTMLElement).style.backgroundColor = "transparent";
            }
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            padding: "4px 8px",
            "background-color": "var(--bg-tertiary, var(--cortex-bg-primary))",
            "border-bottom": "1px solid var(--border, #333)",
            gap: "8px",
          }}
        >
          {/* Channel Selector */}
          <div
            ref={dropdownRef}
            style={{
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowDropdown(!showDropdown())}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "4px",
                padding: "4px 8px",
                background: "transparent",
                border: "1px solid var(--border, #333)",
                "border-radius": "var(--cortex-radius-sm)",
                color: "var(--text, #ccc)",
                cursor: "pointer",
                "font-size": "12px",
                "min-width": "140px",
                "justify-content": "space-between",
              }}
            >
              <span style={{ "text-overflow": "ellipsis", overflow: "hidden", "white-space": "nowrap" }}>
                {activeChannel()?.label ?? "Select Channel"}
              </span>
              <Icon 
                name="chevron-down"
                size={14}
                style={{
                  transform: showDropdown() ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s ease",
                  "flex-shrink": "0",
                }}
              />
            </button>

            <Show when={showDropdown()}>
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: "0",
                  "margin-top": "4px",
                  "min-width": "180px",
                  "max-height": "300px",
                  overflow: "auto",
                  "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
                  border: "1px solid var(--border, #333)",
                  "border-radius": "var(--cortex-radius-sm)",
                  "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.3)",
                  "z-index": "1000",
                }}
              >
                <For each={channelNames()}>
                  {(name) => {
                    const channel = output.getChannel(name);
                    const isActive = () => output.state.activeChannel === name;
                    const lineCount = () => output.getLineCount(name);
                    
                    return (
                      <button
                        onClick={() => handleSelectChannel(name)}
                        style={{
                          display: "flex",
                          "align-items": "center",
                          "justify-content": "space-between",
                          width: "100%",
                          padding: "8px 12px",
                          background: isActive() ? "var(--bg-active, var(--cortex-bg-hover))" : "transparent",
                          border: "none",
                          color: "var(--text, #ccc)",
                          cursor: "pointer",
                          "font-size": "12px",
                          "text-align": "left",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive()) {
                            (e.target as HTMLElement).style.backgroundColor = "var(--bg-hover, var(--cortex-bg-hover))";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive()) {
                            (e.target as HTMLElement).style.backgroundColor = "transparent";
                          }
                        }}
                      >
                        <span>{channel?.label ?? name}</span>
                        <Show when={lineCount() > 0}>
                          <span
                            style={{
                              "font-size": "10px",
                              color: "var(--text-muted, #888)",
                              "background-color": "var(--bg-tertiary, var(--cortex-bg-primary))",
                              padding: "2px 6px",
                              "border-radius": "var(--cortex-radius-md)",
                            }}
                          >
                            {lineCount()}
                          </span>
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>

          {/* Spacer */}
          <div style={{ flex: "1" }} />

          {/* Toolbar Buttons */}
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "4px",
            }}
          >
            {/* Log Level Selector */}
            <LogLevelSelector compact={true} showChannelControls={true} />

            {/* Word Wrap Toggle */}
            <button
              onClick={() => setWordWrap(!wordWrap())}
              title={wordWrap() ? "Disable Word Wrap" : "Enable Word Wrap"}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "28px",
                height: "28px",
                background: wordWrap() ? "var(--bg-active, var(--cortex-bg-hover))" : "transparent",
                border: "none",
                "border-radius": "var(--cortex-radius-sm)",
                color: "var(--text, #ccc)",
                cursor: "pointer",
              }}
            >
              <Show when={wordWrap()} fallback={<Icon name="align-left" size={14} />}>
                <Icon name="align-justify" size={14} />
              </Show>
            </button>

            {/* Scroll Lock Toggle */}
            <button
              onClick={() => {
                const newLocked = !scrollLocked();
                setScrollLocked(newLocked);
                if (!newLocked) {
                  scrollToBottom();
                }
              }}
              title={scrollLocked() ? "Unlock Scroll (Ctrl+Shift+L)" : "Lock Scroll (Ctrl+Shift+L)"}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "28px",
                height: "28px",
                background: scrollLocked() ? "var(--bg-active, var(--cortex-bg-hover))" : "transparent",
                border: "none",
                "border-radius": "var(--cortex-radius-sm)",
                color: scrollLocked() ? "var(--warning, var(--cortex-syntax-function))" : "var(--text, #ccc)",
                cursor: "pointer",
              }}
            >
              <Show when={scrollLocked()} fallback={<Icon name="lock-open" size={14} />}>
                <Icon name="lock" size={14} />
              </Show>
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              title="Copy Output"
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "28px",
                height: "28px",
                background: "transparent",
                border: "none",
                "border-radius": "var(--cortex-radius-sm)",
                color: "var(--text, #ccc)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "var(--bg-hover, var(--cortex-bg-hover))";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              <Icon name="copy" size={14} />
            </button>

            {/* Clear Button */}
            <button
              onClick={handleClear}
              title="Clear Output"
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "28px",
                height: "28px",
                background: "transparent",
                border: "none",
                "border-radius": "var(--cortex-radius-sm)",
                color: "var(--text, #ccc)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "var(--bg-hover, var(--cortex-bg-hover))";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              <Icon name="trash" size={14} />
            </button>

            {/* Maximize/Minimize Toggle */}
            <button
              onClick={toggleMaximize}
              title={isMaximized() ? "Restore Size" : "Maximize"}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "28px",
                height: "28px",
                background: "transparent",
                border: "none",
                "border-radius": "var(--cortex-radius-sm)",
                color: "var(--text, #ccc)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "var(--bg-hover, var(--cortex-bg-hover))";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              <Show when={isMaximized()} fallback={<Icon name="maximize" size={14} />}>
                <Icon name="minimize" size={14} />
              </Show>
            </button>

            {/* Close Button */}
            <button
              onClick={handleClose}
              title="Close Output Panel"
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "28px",
                height: "28px",
                background: "transparent",
                border: "none",
                "border-radius": "var(--cortex-radius-sm)",
                color: "var(--text, #ccc)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "var(--bg-hover, var(--cortex-bg-hover))";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              <Icon name="xmark" size={14} />
            </button>
          </div>
        </div>

        {/* Output Content */}
        <div
          ref={outputRef}
          onScroll={handleScroll}
          style={{
            flex: "1",
            overflow: "auto",
            "background-color": "var(--bg-primary, var(--cortex-bg-primary))",
            color: "var(--text, var(--cortex-text-primary))",
            "user-select": "text",
          }}
        >
          <Show
            when={lines().length > 0}
            fallback={
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  height: "100%",
                  color: "var(--text-muted, #888)",
                  "font-style": "italic",
                }}
              >
                <Show
                  when={activeChannel()}
                  fallback="Select a channel to view output"
                >
                  No output in {activeChannel()?.label ?? "this channel"}
                </Show>
              </div>
            }
          >
            <For each={lines()}>
              {(line) => <OutputLineRenderer line={line} wordWrap={wordWrap()} />}
            </For>
          </Show>
        </div>
      </div>
    </Show>
  );
}

export default OutputPanel;

