/**
 * =============================================================================
 * CUSTOM TITLE BAR - VS Code Style with Tauri Integration
 * =============================================================================
 * 
 * A custom title bar component that provides:
 * - Window title with workspace name
 * - App icon/logo
 * - Menu bar integration (File, Edit, View, etc.)
 * - Window controls (minimize, maximize, close) with Tauri
 * - Draggable region for window movement
 * - Command Center placeholder (center)
 * - Layout controls button
 * - Focused/unfocused styling
 * - Maximized state detection
 * 
 * Settings:
 * - window.titleBarStyle: native | custom
 * - window.menuBarVisibility: classic | compact | toggle | hidden
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  Show,
  For,
  type JSX,
  type Component,
} from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { tokens } from "@/design-system/tokens";
import { useSettings, type MenuBarVisibility, type TitleBarStyle } from "@/context/SettingsContext";
import { useCommands } from "@/context/CommandContext";
import { useSDK } from "@/context/SDKContext";
import { gitCurrentBranch } from "@/utils/tauri-api";
import { Icon } from "./ui/Icon";

// =============================================================================
// TYPES
// =============================================================================

interface TitleBarProps {
  /** Override the title bar style */
  style?: TitleBarStyle;
  /** Show menu bar */
  showMenuBar?: boolean;
  /** Custom class name */
  class?: string;
}

interface WindowState {
  isMaximized: boolean;
  isFocused: boolean;
  isFullscreen: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TITLEBAR_HEIGHT = 32;
const WINDOW_CONTROL_WIDTH = 46;

// =============================================================================
// TITLE BAR COMPONENT
// =============================================================================

export const TitleBar: Component<TitleBarProps> = (props) => {
  // Contexts
  let settingsCtx: ReturnType<typeof useSettings> | null = null;
  let commands: ReturnType<typeof useCommands> | null = null;
  let sdk: ReturnType<typeof useSDK> | null = null;

  try {
    settingsCtx = useSettings();
    commands = useCommands();
    sdk = useSDK();
  } catch {
    // Context not available yet
  }

  // Window state
  const [windowState, setWindowState] = createSignal<WindowState>({
    isMaximized: false,
    isFocused: true,
    isFullscreen: false,
  });

  // Git branch
  const [gitBranch, setGitBranch] = createSignal<string>("");

  // Menu bar visibility from settings
  const menuBarVisibility = createMemo<MenuBarVisibility>(() => {
    return settingsCtx?.effectiveSettings().theme.menuBarVisibility ?? "classic";
  });

  // Show menu bar based on settings and props
  const showMenuBar = createMemo(() => {
    if (props.showMenuBar !== undefined) return props.showMenuBar;
    const visibility = menuBarVisibility();
    return visibility === "classic" || visibility === "compact";
  });

  // Workspace/project name
  const workspaceName = createMemo(() => {
    const cwd = sdk?.state.config.cwd;
    if (!cwd || cwd === ".") return "";
    return cwd.replace(/\\/g, "/").split("/").pop() || "";
  });

  // Focused state style
  const isFocused = createMemo(() => windowState().isFocused);

  // Fetch git branch
  const fetchGitBranch = async () => {
    const cwd = sdk?.state.config.cwd;
    if (!cwd || cwd === ".") {
      setGitBranch("");
      return;
    }
    try {
      const branch = await gitCurrentBranch(cwd);
      setGitBranch(branch || "");
    } catch {
      setGitBranch("");
    }
  };

  // Window state management
  let appWindow: Awaited<ReturnType<typeof getCurrentWindow>> | null = null;
  const listeners: (() => void)[] = [];

  onMount(async () => {
    try {
      appWindow = getCurrentWindow();

      // Initial state
      const [isMaximized, isFullscreen] = await Promise.all([
        appWindow.isMaximized(),
        appWindow.isFullscreen(),
      ]);
      setWindowState({ isMaximized, isFocused: true, isFullscreen });

      // Listen for window state changes
      const unlistenResize = await appWindow.onResized(async () => {
        if (appWindow) {
          const [isMaximized, isFullscreen] = await Promise.all([
            appWindow.isMaximized(),
            appWindow.isFullscreen(),
          ]);
          setWindowState((prev) => ({ ...prev, isMaximized, isFullscreen }));
        }
      });
      listeners.push(unlistenResize);

      // Listen for focus changes
      const unlistenFocus = await appWindow.onFocusChanged(({ payload }) => {
        setWindowState((prev) => ({ ...prev, isFocused: payload }));
      });
      listeners.push(unlistenFocus);

      // Fetch git branch
      fetchGitBranch();

      // Refresh git branch periodically
      const interval = setInterval(fetchGitBranch, 30000);
      onCleanup(() => clearInterval(interval));
    } catch (e) {
      console.error("[TitleBar] Failed to initialize window:", e);
    }
  });

  onCleanup(() => {
    listeners.forEach((unlisten) => unlisten());
  });

  // Window control handlers
  const handleMinimize = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (appWindow) await appWindow.minimize();
    } catch (err) {
      console.error("Minimize failed:", err);
    }
  };

  const handleMaximize = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (appWindow) await appWindow.toggleMaximize();
    } catch (err) {
      console.error("Maximize failed:", err);
    }
  };

  const handleClose = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (appWindow) await appWindow.close();
    } catch (err) {
      console.error("Close failed:", err);
    }
  };

  // Open file finder
  const openFileFinder = () => {
    commands?.setShowFileFinder(true);
  };

  return (
    <header
      class={`titlebar ${props.class || ""}`}
      data-tauri-drag-region
      style={{
        display: "flex",
        "align-items": "center",
        height: `${TITLEBAR_HEIGHT}px`,
        "min-height": `${TITLEBAR_HEIGHT}px`,
        background: isFocused()
          ? "var(--jb-panel)"
          : "var(--jb-canvas)",
        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
        "user-select": "none",
        position: "relative",
        "z-index": tokens.zIndex.sticky,
        transition: "background-color 150ms ease",
      }}
    >
      {/* App Icon */}
      <AppIcon />

      {/* Menu Bar - conditional based on visibility setting */}
      <Show when={showMenuBar()}>
        <TitleBarMenuBar compact={menuBarVisibility() === "compact"} />
      </Show>

      {/* Center: Command Center / Search */}
      <CommandCenter
        workspaceName={workspaceName()}
        onClick={openFileFinder}
      />

      {/* Right side: Layout controls and workspace info */}
      <div
        class="titlebar-right"
        style={{
          display: "flex",
          "align-items": "center",
          gap: tokens.spacing.sm,
          "padding-right": tokens.spacing.sm,
          "pointer-events": "auto",
        }}
      >
        {/* Workspace indicator with git branch */}
        <Show when={workspaceName()}>
          <WorkspaceIndicator
            name={workspaceName()}
            branch={gitBranch()}
          />
        </Show>

        {/* Layout controls */}
        <LayoutControls />

        {/* Window Controls */}
        <WindowControls
          isMaximized={windowState().isMaximized}
          onMinimize={handleMinimize}
          onMaximize={handleMaximize}
          onClose={handleClose}
        />
      </div>
    </header>
  );
};

// =============================================================================
// APP ICON
// =============================================================================

const AppIcon: Component = () => {
  return (
    <div
      class="titlebar-icon"
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        width: "40px",
        height: `${TITLEBAR_HEIGHT}px`,
        "flex-shrink": "0",
        "pointer-events": "auto",
      }}
    >
      {/* Orion Logo - Simple stylized 'O' */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        style={{ color: tokens.colors.accent.primary }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
        />
        <circle
          cx="12"
          cy="12"
          r="4"
          fill="currentColor"
        />
      </svg>
    </div>
  );
};

// =============================================================================
// MENU BAR
// =============================================================================

interface TitleBarMenuBarProps {
  compact?: boolean;
}

const TitleBarMenuBar: Component<TitleBarMenuBarProps> = (props) => {
  const menuItems = ["File", "Edit", "Selection", "View", "Go", "Terminal", "Help"];

  return (
    <nav
      class="titlebar-menu"
      style={{
        display: "flex",
        "align-items": "center",
        height: "100%",
        gap: "2px",
        "padding-left": tokens.spacing.xs,
        "pointer-events": "auto",
      }}
    >
      <For each={menuItems}>
        {(item) => (
          <button
            class="titlebar-menu-item"
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              height: "24px",
              padding: props.compact ? "0 6px" : "0 8px",
              "font-size": props.compact ? "11px" : "12px",
              "font-weight": "400",
              color: tokens.colors.text.muted,
              background: "transparent",
              border: "none",
              "border-radius": tokens.radius.sm,
              cursor: "pointer",
              transition: "background-color 100ms ease, color 100ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
              e.currentTarget.style.color = tokens.colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = tokens.colors.text.muted;
            }}
            onClick={() => {
              // Menu handling would go here - dispatch to MenuBar component
              window.dispatchEvent(
                new CustomEvent("titlebar:menu", { detail: { menu: item } })
              );
            }}
          >
            {item}
          </button>
        )}
      </For>
    </nav>
  );
};

// =============================================================================
// COMMAND CENTER
// =============================================================================

interface CommandCenterProps {
  workspaceName?: string;
  onClick?: () => void;
}

const CommandCenter: Component<CommandCenterProps> = (props) => {
  return (
    <div
      class="titlebar-command-center"
      data-tauri-drag-region
      style={{
        flex: "1",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        height: "100%",
        "min-width": "0",
        "pointer-events": "none",
      }}
    >
      <button
        class="command-center-button"
        onClick={(e) => {
          e.stopPropagation();
          props.onClick?.();
        }}
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          gap: tokens.spacing.sm,
          width: "clamp(200px, 40%, 480px)",
          height: "22px",
          padding: `0 ${tokens.spacing.md}`,
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          "border-radius": tokens.radius.sm,
          color: tokens.colors.text.muted,
          "font-size": "11px",
          cursor: "text",
          transition: "all 150ms ease",
          "pointer-events": "auto",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.07)";
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
        }}
      >
        <Icon
          name="magnifying-glass"
          style={{ width: "12px", height: "12px", "flex-shrink": "0" }}
        />
        <span
          style={{
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
          }}
        >
          {props.workspaceName || "Search files and commands..."}
        </span>
        <kbd
          style={{
            "margin-left": "auto",
            padding: "1px 4px",
            "font-size": "10px",
            "font-family": tokens.typography.fontFamily.mono,
            background: "rgba(255, 255, 255, 0.08)",
            "border-radius": "var(--cortex-radius-sm)",
            color: tokens.colors.text.muted,
          }}
        >
          Ctrl+P
        </kbd>
      </button>
    </div>
  );
};

// =============================================================================
// WORKSPACE INDICATOR
// =============================================================================

interface WorkspaceIndicatorProps {
  name: string;
  branch?: string;
}

const WorkspaceIndicator: Component<WorkspaceIndicatorProps> = (props) => {
  return (
    <div
      class="titlebar-workspace"
      style={{
        display: "flex",
        "align-items": "center",
        gap: tokens.spacing.sm,
        padding: `0 ${tokens.spacing.md}`,
        height: "24px",
        "font-size": "11px",
        color: tokens.colors.text.muted,
        "border-radius": tokens.radius.sm,
        cursor: "default",
      }}
    >
      <Icon name="folder" style={{ width: "12px", height: "12px", opacity: "0.7" }} />
      <span style={{ "font-weight": "500", color: tokens.colors.text.primary }}>
        {props.name}
      </span>
      <Show when={props.branch}>
        <span
          style={{
            display: "flex",
            "align-items": "center",
            gap: "4px",
            "padding-left": tokens.spacing.sm,
            "border-left": `1px solid ${tokens.colors.border.divider}`,
          }}
        >
          <Icon name="code-branch" style={{ width: "11px", height: "11px", opacity: "0.7" }} />
          <span>{props.branch}</span>
        </span>
      </Show>
    </div>
  );
};

// =============================================================================
// LAYOUT CONTROLS
// =============================================================================

const LayoutControls: Component = () => {
  return (
    <button
      class="titlebar-layout-controls"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("layout:toggle-panel"));
      }}
      title="Toggle Panel"
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        width: "28px",
        height: "24px",
        background: "transparent",
        border: "none",
        "border-radius": tokens.radius.sm,
        color: tokens.colors.text.muted,
        cursor: "pointer",
        transition: "background-color 100ms ease, color 100ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tokens.colors.interactive.hover;
        e.currentTarget.style.color = tokens.colors.text.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = tokens.colors.text.muted;
      }}
    >
      <Icon name="table-columns" style={{ width: "14px", height: "14px" }} />
    </button>
  );
};

// =============================================================================
// WINDOW CONTROLS
// =============================================================================

interface WindowControlsProps {
  isMaximized: boolean;
  onMinimize: (e: MouseEvent) => void;
  onMaximize: (e: MouseEvent) => void;
  onClose: (e: MouseEvent) => void;
}

const WindowControls: Component<WindowControlsProps> = (props) => {
  const controlStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: `${WINDOW_CONTROL_WIDTH}px`,
    height: `${TITLEBAR_HEIGHT}px`,
    background: "transparent",
    border: "none",
    color: tokens.colors.text.muted,
    cursor: "pointer",
    transition: "background-color 100ms ease",
  };

  return (
    <div
      class="window-controls-container"
      style={{
        display: "flex",
        "align-items": "center",
        height: `${TITLEBAR_HEIGHT}px`,
        "-webkit-app-region": "no-drag",
      }}
    >
      {/* Minimize */}
      <button
        class="window-control window-minimize"
        onClick={props.onMinimize}
        title="Minimize"
        style={controlStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Icon name="minus" style={{ width: "14px", height: "14px" }} />
      </button>

      {/* Maximize/Restore */}
      <button
        class="window-control window-maximize"
        onClick={props.onMaximize}
        title={props.isMaximized ? "Restore" : "Maximize"}
        style={controlStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Show
          when={props.isMaximized}
          fallback={<Icon name="square" style={{ width: "12px", height: "12px" }} />}
        >
          {/* Restore icon */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="7" width="14" height="14" rx="2" />
            <path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
          </svg>
        </Show>
      </button>

      {/* Close */}
      <button
        class="window-control window-close"
        onClick={props.onClose}
        title="Close"
        style={{
          ...controlStyle,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = tokens.colors.semantic.error;
          e.currentTarget.style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = tokens.colors.text.muted;
        }}
      >
        <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
      </button>
    </div>
  );
};

// =============================================================================
// HELPER HOOK
// =============================================================================

/**
 * Hook to determine if custom title bar should be used.
 * Returns true if titleBarStyle is "custom", false if "native".
 */
export function useCustomTitleBar(): boolean {
  let settingsCtx: ReturnType<typeof useSettings> | null = null;
  try {
    settingsCtx = useSettings();
  } catch {
    // Context not available, default to custom
    return true;
  }
  
  const titleBarStyle = settingsCtx?.effectiveSettings().theme.titleBarStyle ?? "custom";
  return titleBarStyle === "custom";
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { TitleBarStyle };
export default TitleBar;

