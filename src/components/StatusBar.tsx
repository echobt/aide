import { createSignal, Show, onMount, onCleanup, createEffect, createMemo, For } from "solid-js";
import { tokens } from "@/design-system/tokens";
import { useEditor } from "@/context/EditorContext";
import { useCommands } from "@/context/CommandContext";
import { useVim } from "@/context/VimContext";
import { useTerminals } from "@/context/TerminalsContext";
import { type ToolchainKind } from "@/context/ToolchainContext";
import { useFormatter, type FormattingStatus } from "@/context/FormatterContext";
import { useLanguageSelector } from "@/context/LanguageSelectorContext";
import { useEncoding } from "@/context/EncodingContext";
import { DiagnosticsSummary } from "@/components/editor/DiagnosticsPanel";
import { CopilotStatusIndicator, CopilotSignInModal } from "@/components/ai/CopilotStatus";
import { SupermavenStatusIndicator } from "@/components/ai/SupermavenStatus";
import { ToolchainStatus } from "@/components/ToolchainSelector";
import { AutoUpdateStatusBadge } from "@/components/AutoUpdate";
import { ActivityIndicator } from "@/components/ActivityIndicator";
import { LanguageStatusItems } from "@/components/LanguageStatusItem";
import { NotificationCenterButton } from "@/components/NotificationCenter";
import { AuxiliaryBarToggle } from "@/components/AuxiliaryBar";
import { ProfileStatusBarItem } from "@/components/profiles";
import { DebugStatusBar, useDebugStatusBar } from "@/components/debugger";
import { IconButton, Text, Button, Divider, Card } from "@/components/ui";
import { Icon } from "./ui/Icon";
import { gitCurrentBranch, fsDetectEol, fsConvertEol, type LineEndingType } from "../utils/tauri-api";
import { getProjectPath } from "../utils/workspace";

export function StatusBar() {
  const { state } = useEditor();
  const { setShowGoToLine, setShowCommandPalette } = useCommands();
  const vim = useVim();
  const formatter = useFormatter();
  const languageSelector = useLanguageSelector();
  const encodingCtx = useEncoding();
  const terminals = useTerminals();
  const debugStatus = useDebugStatusBar();
  const [cursorPosition, setCursorPosition] = createSignal({ line: 1, column: 1 });
  const [cursorCount, setCursorCount] = createSignal(1);
  const [selectionCount, setSelectionCount] = createSignal(0);
  const [gitBranch, setGitBranch] = createSignal<string | null>(null);
  const [lineEnding, setLineEnding] = createSignal<LineEndingType>("LF");
  const [showCopilotModal, setShowCopilotModal] = createSignal(false);
  const [showEolPicker, setShowEolPicker] = createSignal(false);
  const [columnSelectionMode, setColumnSelectionMode] = createSignal(false);
  const [renderWhitespace, setRenderWhitespace] = createSignal<"none" | "boundary" | "selection" | "trailing" | "all">("none");

  // PERFORMANCE: Memoize these to prevent recalculation on every render
  const activeFile = createMemo(() => state.openFiles.find((f) => f.id === state.activeFileId));
  const groupCount = createMemo(() => state.groups.length);
  const hasSplits = createMemo(() => state.splits.length > 0);

onMount(() => {
    const handleCursorChange = (e: CustomEvent) => {
      if (!e.detail) return;
      setCursorPosition({
        line: e.detail.line ?? 1,
        column: e.detail.column ?? 1,
      });
      if (e.detail.cursorCount !== undefined) {
        setCursorCount(e.detail.cursorCount);
      }
      if (e.detail.selectionCount !== undefined) {
        setSelectionCount(e.detail.selectionCount);
      }
    };
    window.addEventListener("editor-cursor-change", handleCursorChange as EventListener);
    
    // Listen for column selection mode changes
    const handleColumnSelectionChange = (e: CustomEvent) => {
      setColumnSelectionMode(e.detail?.enabled ?? false);
    };
    window.addEventListener("editor:column-selection-changed", handleColumnSelectionChange as EventListener);
    
    // Listen for render whitespace changes
    const handleRenderWhitespaceChange = (e: CustomEvent) => {
      setRenderWhitespace(e.detail?.mode ?? "none");
    };
    window.addEventListener("editor:render-whitespace-changed", handleRenderWhitespaceChange as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("editor-cursor-change", handleCursorChange as EventListener);
      window.removeEventListener("editor:column-selection-changed", handleColumnSelectionChange as EventListener);
      window.removeEventListener("editor:render-whitespace-changed", handleRenderWhitespaceChange as EventListener);
    });
  });

  createEffect(() => {
    setCursorCount(state.cursorCount);
    setSelectionCount(state.selectionCount);
  });

  onMount(() => {
    fetchGitBranch();
  });

  // Detect EOL when active file changes
  createEffect(() => {
    const file = activeFile();
    if (file && file.path && !file.path.startsWith("virtual://")) {
      fsDetectEol(file.path)
        .then((eol) => setLineEnding(eol))
        .catch(() => setLineEnding("LF")); // Default to LF on error
    } else {
      setLineEnding("LF");
    }
  });

  const fetchGitBranch = async () => {
    try {
      const projectPath = getProjectPath();
      if (!projectPath) return;
      const branch = await gitCurrentBranch(projectPath);
      setGitBranch(branch);
    } catch {
      // Git not available or not a repo
    }
  };

  const getLanguageDisplay = () => {
    const file = activeFile();
    if (!file) return "Plain Text";
    const override = languageSelector.state.fileLanguageOverrides[file.id];
    if (override) {
      return languageSelector.getLanguageDisplayName(override);
    }
    return languageSelector.getLanguageDisplayName(file.language || "plaintext");
  };

  const handleLanguageClick = () => {
    const file = activeFile();
    if (file) {
      languageSelector.openSelector(file.id);
    }
  };

  const getIndentation = () => "Spaces: 2";

  const getCursorDisplay = () => {
    const count = cursorCount();
    if (count > 1) {
      return `${count} cursors`;
    }
    return `Ln ${cursorPosition().line}, Col ${cursorPosition().column}`;
  };

  const getSelectionDisplay = () => {
    const count = selectionCount();
    if (count > 0) {
      return `(${count} selected)`;
    }
    return null;
  };

  const openGitPanel = () => {
    window.dispatchEvent(new CustomEvent("git:toggle"));
  };

  const handleEolClick = () => {
    setShowEolPicker(!showEolPicker());
  };

  // Get encoding for current file
  const fileEncoding = createMemo(() => {
    const file = activeFile();
    if (!file) return "UTF-8";
    return encodingCtx.getFileEncoding(file.id);
  });

  const handleEncodingClick = () => {
    const file = activeFile();
    if (file && file.path && !file.path.startsWith("virtual://")) {
      encodingCtx.openPicker(file.id, file.path, "reopen");
    }
  };

  const handleEolChange = async (eol: LineEndingType) => {
    const file = activeFile();
    if (file && file.path && !file.path.startsWith("virtual://")) {
      try {
        await fsConvertEol(file.path, eol);
        setLineEnding(eol);
        // Emit event to reload file content in editor
        window.dispatchEvent(
          new CustomEvent("file:reload", { detail: { path: file.path } })
        );
      } catch (e) {
        console.error("Failed to convert line endings:", e);
      }
    }
    setShowEolPicker(false);
  };

  // Status bar item styles - Design System
  const itemBaseClass = "flex items-center gap-1 cursor-pointer";
  const itemHoverStyle = `hover:bg-[${tokens.colors.interactive.hover}]`;
  const itemStyle = {
    padding: `0 ${tokens.spacing.md}`,
    "line-height": "22px",
    transition: "background-color 100ms ease",
    "white-space": "nowrap",
  };

return (
    <div 
      class="flex items-center justify-between select-none shrink-0"
      role="status"
      aria-label="Status bar"
      style={{ 
        height: "22px",
        "min-height": "22px",
        "max-height": "22px",
        // Glassmorphism: Inherit from html background, no borders for seamless look
        color: tokens.colors.text.muted,
        "font-size": "var(--jb-text-muted-size)",
        "font-weight": "400",
      }}
    >
      {/* Left section: branch info, sync status - Rule of Thirds placement */}
      <div class="flex items-center">
        {/* Remote/Connected indicator - colored accent background */}
        <div 
          class="flex items-center cursor-pointer"
          style={{
            background: tokens.colors.semantic.primary,
            color: "white",
            "font-size": "var(--jb-text-muted-size)",
            padding: `0 ${tokens.spacing.md}`,
            height: "22px",
            gap: tokens.spacing.sm,
          }}
          title="Connected to Local"
        >
          <svg style={{ width: "14px", height: "14px" }} viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a2.5 2.5 0 0 0-2.5 2.5v.5H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.5v-.5A2.5 2.5 0 0 0 8 1zm0 1a1.5 1.5 0 0 1 1.5 1.5v.5h-3v-.5A1.5 1.5 0 0 1 8 2z"/>
          </svg>
          <span>Local</span>
        </div>
        <Show when={vim.enabled()}>
          <div 
            class="flex items-center font-mono font-semibold"
            style={{
              "font-size": "10px",
              padding: `0 ${tokens.spacing.md}`,
              background: vim.mode() === "insert" 
                ? tokens.colors.semantic.success 
                : vim.mode() === "visual" || vim.mode() === "visual-line"
                  ? tokens.colors.semantic.warning
                  : vim.mode() === "command"
                    ? tokens.colors.semantic.primary
                    : tokens.colors.semantic.primary,
              color: "white",
            }}
          >
            <span>{vim.getModeDisplay()}</span>
          </div>
          <Show when={vim.mode() === "command"}>
            <Text variant="muted" style={{ "font-family": "var(--jb-font-mono)", padding: `0 ${tokens.spacing.md}` }}>
              {vim.commandBuffer()}
            </Text>
          </Show>
          <StatusDivider />
        </Show>

        <Show when={gitBranch()}>
          <button 
            class={`${itemBaseClass} ${itemHoverStyle}`}
            onClick={openGitPanel}
            title="Toggle Git Panel"
            style={{ ...itemStyle, color: tokens.colors.text.muted }}
            onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.muted}
          >
            <Icon name="code-branch" style={{ width: "14px", height: "14px", color: tokens.colors.text.muted }} />
            <Text variant="muted">{gitBranch()}</Text>
          </button>
        </Show>

        <DiagnosticsSummary
          onClick={() => window.dispatchEvent(new CustomEvent("problems:toggle"))}
        />

        {/* Debug Status Bar - shown when debugging */}
        <Show when={debugStatus.isDebugging()}>
          <StatusDivider />
          <DebugStatusBar
            session={debugStatus.session()}
            onContinue={debugStatus.onContinue}
            onPause={debugStatus.onPause}
            onStop={debugStatus.onStop}
            onRestart={debugStatus.onRestart}
          />
        </Show>

        <Show when={hasSplits()}>
          <StatusDivider />
          <div class={itemBaseClass} style={{ ...itemStyle, color: tokens.colors.text.muted }}>
            <Icon name="columns" style={{ width: "14px", height: "14px", color: tokens.colors.text.muted }} />
            <Text variant="muted">{groupCount()}</Text>
          </div>
        </Show>

        {/* Column Selection Mode Indicator */}
        <Show when={columnSelectionMode()}>
          <StatusDivider />
          <button 
            class={`${itemBaseClass} ${itemHoverStyle}`}
            onClick={() => window.dispatchEvent(new CustomEvent("editor-command", { detail: { command: "toggle-column-selection" } }))}
            title="Column Selection Mode Active (Ctrl+Shift+C to toggle)"
            style={{ ...itemStyle, color: tokens.colors.semantic.primary }}
            onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.semantic.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.semantic.primary}
          >
            <Icon name="table-cells" style={{ width: "14px", height: "14px" }} />
            <Text variant="muted" style={{ color: tokens.colors.semantic.primary }}>Column</Text>
          </button>
        </Show>

        {/* Render Whitespace Indicator */}
        <Show when={renderWhitespace() !== "none"}>
          <StatusDivider />
          <button 
            class={`${itemBaseClass} ${itemHoverStyle}`}
            onClick={() => window.dispatchEvent(new CustomEvent("view:toggle-render-whitespace"))}
            title={`Render Whitespace: ${renderWhitespace()} (Click to toggle)`}
            style={{ ...itemStyle, color: tokens.colors.text.muted }}
            onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.muted}
          >
            <Icon name="eye" style={{ width: "14px", height: "14px" }} />
            <Text variant="muted">WS: {renderWhitespace()}</Text>
          </button>
        </Show>

        <ActivityIndicator />
      </div>

      {/* Right section: line/col, encoding, language, notifications - Rule of Thirds placement */}
      <div class="flex items-center">
        <Show when={activeFile()}>
          <button 
            class={`${itemBaseClass} ${itemHoverStyle}`}
            onClick={() => cursorCount() <= 1 && setShowGoToLine(true)}
            title={cursorCount() > 1 ? `${cursorCount()} cursors active` : "Go to Line (Ctrl+G)"}
            style={{ ...itemStyle, color: cursorCount() > 1 ? tokens.colors.semantic.primary : tokens.colors.text.muted }}
            onMouseEnter={(e) => e.currentTarget.style.color = cursorCount() > 1 ? tokens.colors.semantic.primary : tokens.colors.text.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = cursorCount() > 1 ? tokens.colors.semantic.primary : tokens.colors.text.muted}
          >
            <Show when={cursorCount() > 1}>
              <Icon name="pen" style={{ width: "14px", height: "14px", color: tokens.colors.text.muted }} />
            </Show>
            <Text variant="muted">{getCursorDisplay()}</Text>
            <Show when={getSelectionDisplay()}>
              <Text variant="muted" style={{ opacity: 0.7 }}>{getSelectionDisplay()}</Text>
            </Show>
          </button>
        </Show>

        <Show when={activeFile()}>
          <StatusDivider />
          <Text 
            variant="muted"
            style={{ ...itemStyle, cursor: "default" }}
          >
            {getIndentation()}
          </Text>
        </Show>

        <Show when={activeFile()}>
          <StatusDivider />
          <button 
            class={`${itemBaseClass} ${itemHoverStyle}`}
            onClick={handleEncodingClick}
            title="File Encoding (Click to change)"
            style={{ ...itemStyle, color: tokens.colors.text.muted, "font-size": "var(--jb-text-muted-size)" }}
            onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.muted}
          >
            {fileEncoding()}
          </button>
        </Show>

        <Show when={activeFile()}>
          <div class="relative">
            <button 
              class={`${itemBaseClass} ${itemHoverStyle}`}
              onClick={handleEolClick}
              title={`Line Ending: ${lineEnding()} (Click to change)`}
              style={{ ...itemStyle, color: lineEnding() === "Mixed" ? tokens.colors.semantic.warning : tokens.colors.text.muted, "font-size": "var(--jb-text-muted-size)" }}
              onMouseEnter={(e) => e.currentTarget.style.color = lineEnding() === "Mixed" ? tokens.colors.semantic.warning : tokens.colors.text.primary}
              onMouseLeave={(e) => e.currentTarget.style.color = lineEnding() === "Mixed" ? tokens.colors.semantic.warning : tokens.colors.text.muted}
            >
              {lineEnding()}
            </button>
            <Show when={showEolPicker()}>
              <EolPicker 
                currentEol={lineEnding()} 
                onSelect={handleEolChange} 
                onClose={() => setShowEolPicker(false)} 
              />
            </Show>
          </div>
        </Show>

        <Show when={activeFile()}>
          <StatusDivider />
          <button 
            class={`${itemBaseClass} ${itemHoverStyle}`}
            onClick={handleLanguageClick}
            title="Select Language Mode"
            style={{ ...itemStyle, color: tokens.colors.text.muted, "font-size": "var(--jb-text-muted-size)" }}
            onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.muted}
          >
            {getLanguageDisplay()}
          </button>
          <LanguageStatusItems 
            language={activeFile()?.language || "plaintext"}
            onCommand={(cmd, args) => {
              window.dispatchEvent(
                new CustomEvent("lsp:execute-command", {
                  detail: { command: cmd, arguments: args },
                })
              );
            }}
          />
        </Show>

        <StatusDivider />

        <FormatterStatusIndicator
          status={formatter.state?.status ?? "idle"}
          enabled={formatter.state?.settings?.enabled ?? false}
          formatOnSave={formatter.state?.settings?.formatOnSave ?? false}
          error={formatter.state?.lastError ?? null}
          onClearError={() => formatter.clearError()}
        />

        <ToolchainStatusBar />

        <SupermavenStatusIndicator />

        <CopilotStatusIndicator onClick={() => setShowCopilotModal(true)} />

        <StatusDivider />

        <IconButton
          size="sm"
          variant="ghost"
          onClick={() => window.dispatchEvent(new CustomEvent("feedback:open", { detail: { type: "general" } }))}
          tooltip="Send Feedback (Ctrl+Shift+U)"
        >
          <Icon name="message" />
        </IconButton>

        <AutoUpdateStatusBadge />

        <ProfileStatusBarItem />

        <NotificationCenterButton />

        <AuxiliaryBarToggle />

        <IconButton
          size="sm"
          variant="ghost"
          active={terminals.state?.showPanel}
          onClick={() => terminals.togglePanel()}
          tooltip="Toggle Terminal (Ctrl+`)"
        >
          <Icon name="terminal" />
        </IconButton>

        <IconButton
          size="sm"
          variant="ghost"
          onClick={() => setShowCommandPalette(true)}
          tooltip="Command Palette (Ctrl+Shift+P)"
        >
          <Icon name="command" />
        </IconButton>
      </div>

      <CopilotSignInModal
        isOpen={showCopilotModal()}
        onClose={() => setShowCopilotModal(false)}
      />
    </div>
  );
}

/** Subtle vertical divider between status bar item groups - groups related items per Proximity principle */
function StatusDivider() {
  return (
    <Divider 
      orientation="vertical"
      style={{ 
        height: "14px", 
        opacity: 0.3,
        margin: `0 ${tokens.spacing.sm}`,
      }} 
    />
  );
}

function ToolchainStatusBar() {
  const { state } = useEditor();

  const relevantKind = createMemo<ToolchainKind | null>(() => {
    const activeFile = state.openFiles.find((f) => f.id === state.activeFileId);
    if (!activeFile) return null;

    const lang = activeFile.language?.toLowerCase() || "";
    const filename = activeFile.name?.toLowerCase() || "";

    if (
      lang === "typescript" ||
      lang === "javascript" ||
      filename.endsWith(".js") ||
      filename.endsWith(".ts") ||
      filename.endsWith(".jsx") ||
      filename.endsWith(".tsx") ||
      filename === "package.json"
    ) {
      return "node";
    }

    if (
      lang === "python" ||
      filename.endsWith(".py") ||
      filename === "requirements.txt" ||
      filename === "pyproject.toml"
    ) {
      return "python";
    }

    if (
      lang === "rust" ||
      filename.endsWith(".rs") ||
      filename === "cargo.toml" ||
      filename === "cargo.lock"
    ) {
      return "rust";
    }

    return null;
  });

  return (
    <Show when={relevantKind()}>
      <ToolchainStatus kind={relevantKind()!} />
    </Show>
  );
}

interface FormatterStatusIndicatorProps {
  status: FormattingStatus;
  enabled: boolean;
  formatOnSave: boolean;
  error: string | null;
  onClearError: () => void;
}

function FormatterStatusIndicator(props: FormatterStatusIndicatorProps) {
const getStatusIcon = () => {
    const iconStyle = { width: "14px", height: "14px" };
    switch (props.status) {
      case "formatting":
        return <Icon name="spinner" style={iconStyle} class="animate-spin" />;
      case "success":
        return <Icon name="check" style={iconStyle} />;
      case "error":
        return <Icon name="circle-exclamation" style={iconStyle} />;
      default:
        return <Icon name="code" style={iconStyle} />;
    }
  };

  const getStatusColor = () => {
    if (!props.enabled) return tokens.colors.text.muted;
    switch (props.status) {
      case "formatting":
        return tokens.colors.semantic.primary;
      case "success":
        return tokens.colors.semantic.success;
      case "error":
        return tokens.colors.semantic.error;
      default:
        return tokens.colors.text.muted;
    }
  };

  const getHoverColor = () => {
    if (!props.enabled) return tokens.colors.text.muted;
    switch (props.status) {
      case "formatting":
        return tokens.colors.semantic.primary;
      case "success":
        return tokens.colors.semantic.success;
      case "error":
        return tokens.colors.semantic.error;
      default:
        return tokens.colors.text.primary;
    }
  };

  const getTooltip = () => {
    if (!props.enabled) return "Formatter disabled";
    if (props.error) return `Error: ${props.error}`;
    switch (props.status) {
      case "formatting":
        return "Formatting...";
      case "success":
        return "Formatted successfully";
      case "error":
        return "Formatting error";
      default:
        return props.formatOnSave ? "Format on save enabled" : "Shift+Alt+F to format";
    }
  };

  return (
    <button
      class={`flex items-center gap-1 cursor-pointer hover:bg-[${tokens.colors.interactive.hover}]`}
      style={{ 
        color: getStatusColor(),
        padding: `0 ${tokens.spacing.md}`,
        "line-height": "22px",
        transition: "background-color 100ms ease",
      }}
      title={getTooltip()}
      onMouseEnter={(e) => e.currentTarget.style.color = getHoverColor()}
      onMouseLeave={(e) => e.currentTarget.style.color = getStatusColor()}
      onClick={() => {
        if (props.error) {
          props.onClearError();
        } else {
          window.dispatchEvent(new CustomEvent("editor-format-document"));
        }
      }}
    >
      {getStatusIcon()}
      <Show when={props.enabled}>
        <Text variant="muted">{props.formatOnSave ? "FOS" : "FMT"}</Text>
      </Show>
    </button>
  );
}

/** EOL picker dropdown */
interface EolPickerProps {
  currentEol: LineEndingType;
  onSelect: (eol: LineEndingType) => void;
  onClose: () => void;
}

function EolPicker(props: EolPickerProps) {
  const eolOptions: { value: LineEndingType; label: string; description: string }[] = [
    { value: "LF", label: "LF", description: "Unix/macOS (\\n)" },
    { value: "CRLF", label: "CRLF", description: "Windows (\\r\\n)" },
    { value: "CR", label: "CR", description: "Classic Mac (\\r)" },
  ];

  // Close on click outside
  let pickerRef: HTMLDivElement | undefined;
  
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef && !pickerRef.contains(e.target as Node)) {
        props.onClose();
      }
    };
    // Use setTimeout to avoid immediate close from the click that opened it
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });

  return (
    <Card 
      ref={pickerRef}
      variant="elevated"
      padding="none"
      class="absolute bottom-full mb-1 right-0 z-50"
      style={{
        "min-width": "160px",
        border: `1px solid ${tokens.colors.border.divider}`,
      }}
    >
      <Text 
        variant="muted"
        size="xs"
        style={{ 
          display: "block",
          padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
          "font-weight": "500",
          "border-bottom": `1px solid ${tokens.colors.border.divider}` 
        }}
      >
        Select Line Ending
      </Text>
      <For each={eolOptions}>
        {(option) => (
          <Button
            variant="ghost"
            style={{
              width: "100%",
              padding: `6px ${tokens.spacing.md}`,
              "justify-content": "space-between",
              color: props.currentEol === option.value ? tokens.colors.semantic.primary : tokens.colors.text.primary,
              background: props.currentEol === option.value ? tokens.colors.interactive.selected : "transparent",
              "font-size": "11px",
              "border-radius": "0",
              height: "auto",
            }}
            onMouseEnter={(e) => {
              if (props.currentEol !== option.value) {
                e.currentTarget.style.background = tokens.colors.interactive.hover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = props.currentEol === option.value 
                ? tokens.colors.interactive.selected 
                : "transparent";
            }}
            onClick={() => props.onSelect(option.value)}
          >
            <Text variant="body" weight="medium" style={{ "font-family": "var(--jb-font-mono)" }}>{option.label}</Text>
            <Text variant="muted" size="xs">{option.description}</Text>
          </Button>
        )}
      </For>
    </Card>
  );
}
