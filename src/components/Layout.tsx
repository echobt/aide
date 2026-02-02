import { invoke } from "@tauri-apps/api/core";
import { 
  ParentProps, 
  Show, 
  For, 
  createSignal, 
  createEffect, 
  onMount, 
  onCleanup,
  batch,
  lazy,
  Suspense,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import { tokens } from '@/design-system/tokens';
import { useEventListener, useEventListeners, useCustomEvent } from "../hooks";
// Flex/HStack primitives available if needed for future layout changes
import { getWindowLabel } from "@/utils/windowStorage";
import { useSDK } from "@/context/SDKContext";
import { useTerminals } from "@/context/TerminalsContext";
import { usePreview } from "@/context/PreviewContext";
import { useEditor } from "@/context/EditorContext";
import { useSettings, ActivityBarLocation } from "@/context/SettingsContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useZenMode } from "./ZenMode";
// Removed: useExtensions - was not being used

// ============================================================================
// LIGHT COMPONENTS - Load synchronously (small, always needed)
// ============================================================================
import { StatusBar } from "./StatusBar";
import { ResizeHandle } from "./ResizeHandle";
import { Button, IconButton, ContextMenu, type ContextMenuSection } from "@/components/ui";
import { Icon } from "./ui/Icon";
import { SidebarSkeleton } from "./ui/SidebarSkeleton";
import { EditorSkeleton } from "./editor/EditorSkeleton";
// Removed: AgentSkeleton - was not being used
import { SidebarErrorBoundary, EditorErrorBoundary } from "./ErrorBoundary";
import { LayoutPresetsMenu } from "./layout/LayoutPresetsMenu";
import {
  LayoutPreset,
  LayoutState as PresetLayoutState,
  getActivePresetId,
  setActivePresetId,
  loadCustomPresets,
} from "../types/layout";

// MenuBar is 111KB - lazy load it
const MenuBar = lazy(() => import("./MenuBar").then(m => ({ default: m.MenuBar })));

// ============================================================================
// HEAVY COMPONENTS - Lazy loaded (large bundles, conditionally rendered)
// These are the main performance bottlenecks:
// - EditorPanel: ~2MB (Monaco editor)
// - ExtensionsPanel: ~30KB + dependencies
// - GitPanel, DebuggerPanel, DebugConsole: ~20-50KB each
// - AgentPanel, AgentFactory: ~80KB each
// - SearchSidebar, OutlinePanel: ~15KB each
// ============================================================================
const EditorPanel = lazy(() => import("./editor/EditorPanel").then(m => ({ default: m.EditorPanel })));
const FileExplorer = lazy(() => import("./FileExplorer").then(m => ({ default: m.FileExplorer })));
const GitPanel = lazy(() => import("./git/GitPanel").then(m => ({ default: m.GitPanel })));
const DebuggerPanel = lazy(() => import("./debugger/DebuggerPanel").then(m => ({ default: m.DebuggerPanel })));
const DebugConsole = lazy(() => import("./debugger/DebugConsole").then(m => ({ default: m.DebugConsole })));
const ExtensionsPanel = lazy(() => import("@/components/extensions").then(m => ({ default: m.ExtensionsPanel })));
const SearchSidebar = lazy(() => import("./SearchSidebar").then(m => ({ default: m.SearchSidebar })));
const OutlinePanelSidebar = lazy(() => import("./editor/OutlinePanel").then(m => ({ default: m.OutlinePanelSidebar })));
const CodemapsSidebar = lazy(() => import("./CodemapsSidebar").then(m => ({ default: m.CodemapsSidebar })));
// AgentPanel reserved for future sidebar integration
const _AgentPanel = lazy(() => import("./ai/AgentPanel").then(m => ({ default: m.AgentPanel })));
void _AgentPanel;
const AgentsSidebar = lazy(() => import("./AgentsSidebar").then(m => ({ default: m.AgentsSidebar })));
const AgentFactory = lazy(() => import("./factory/AgentFactory").then(m => ({ default: m.AgentFactory })));
const WebPreview = lazy(() => import("./WebPreview").then(m => ({ default: m.WebPreview })));
const AuxiliaryBar = lazy(() => import("./AuxiliaryBar").then(m => ({ default: m.AuxiliaryBar })));

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// VS Code Layout Dimensions (from workbench_layout_parts analysis)
// ============================================================================

// Activity Bar - 48px fixed width (VS Code standard)
const ACTIVITY_BAR_WIDTH = 48;
// Reserved for future use when sidebar collapse feature is enhanced
const _SIDEBAR_COLLAPSED_WIDTH = ACTIVITY_BAR_WIDTH;
void _SIDEBAR_COLLAPSED_WIDTH;

// Sidebar dimensions
const SIDEBAR_MIN_WIDTH = 160;
const SIDEBAR_MAX_WIDTH = 500;
const SIDEBAR_DEFAULT_WIDTH = 240;

// Right sidebar (Auxiliary Bar) dimensions
const RIGHT_SIDEBAR_MIN_WIDTH = 200;
const RIGHT_SIDEBAR_MAX_WIDTH = 500;
const RIGHT_SIDEBAR_DEFAULT_WIDTH = 280;

// Bottom panel dimensions
const BOTTOM_PANEL_MIN_HEIGHT = 100;
const BOTTOM_PANEL_MAX_HEIGHT = 600;
const BOTTOM_PANEL_DEFAULT_HEIGHT = 220;

// Chat area dimensions
const CHAT_MIN_WIDTH = 300;
const CHAT_MAX_WIDTH = 1200;
const CHAT_DEFAULT_WIDTH = 450;

// Agent panel dimensions
const AGENT_PANEL_MIN_WIDTH = 320;
const AGENT_PANEL_MAX_WIDTH = 600;
const AGENT_PANEL_DEFAULT_WIDTH = 400;

// VS Code Part Heights
const PANEL_HEADER_HEIGHT = 35;   // VS Code Part.TITLE_HEIGHT: 35px

// ============================================================================
// Layout Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  sidebarWidth: "layout_sidebar_width",
  sidebarCollapsed: "layout_sidebar_collapsed",
  sidebarTab: "layout_sidebar_tab",
  rightSidebarWidth: "layout_right_sidebar_width",
  rightSidebarCollapsed: "layout_right_sidebar_collapsed",
  bottomPanelHeight: "layout_bottom_panel_height",
  bottomPanelCollapsed: "layout_bottom_panel_collapsed",
  bottomPanelTab: "layout_bottom_panel_tab",
  bottomPanelMaximized: "layout_bottom_panel_maximized",
  showChat: "layout_show_chat",
  chatWidth: "layout_chat_width",
  agentPanelWidth: "layout_agent_panel_width",
  showAgentPanel: "layout_show_agent_panel",
} as const;

// ============================================================================
// Types
// ============================================================================

type SidebarTab = "files" | "search" | "git" | "extensions" | "debug" | "outline" | "agents" | "wiki" | "codemap" | "design" | "factory";
type BottomPanelTab = "debug-console" | "terminal" | "ports" | "preview";

interface LayoutState {
  sidebar: {
    width: number;
    collapsed: boolean;
    activeTab: SidebarTab;
  };
  rightSidebar: {
    width: number;
    collapsed: boolean;
  };
  bottomPanel: {
    height: number;
    collapsed: boolean;
    maximized: boolean;
    activeTab: BottomPanelTab;
  };
  agentPanel: {
    width: number;
    visible: boolean;
  };
  chat: {
    width: number;
  };
  showChat: boolean;
}

// ============================================================================
// Layout Persistence
// ============================================================================

function safeParseInt(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function loadLayoutState(): LayoutState {
  const label = getWindowLabel();
  const get = (key: string) => localStorage.getItem(`${key}_${label}`) || localStorage.getItem(key);

  // Sidebar should be expanded by default (collapsed only if explicitly set to "true")
  const sidebarCollapsedValue = get(STORAGE_KEYS.sidebarCollapsed);
  const isSidebarCollapsed = sidebarCollapsedValue === "true";

  return {
    sidebar: {
      width: safeParseInt(get(STORAGE_KEYS.sidebarWidth), SIDEBAR_DEFAULT_WIDTH),
      collapsed: isSidebarCollapsed,
      activeTab: (get(STORAGE_KEYS.sidebarTab) as SidebarTab) || "files",
    },
    rightSidebar: {
      width: safeParseInt(get(STORAGE_KEYS.rightSidebarWidth), RIGHT_SIDEBAR_DEFAULT_WIDTH),
      collapsed: get(STORAGE_KEYS.rightSidebarCollapsed) !== "false",
    },
    bottomPanel: {
      height: safeParseInt(get(STORAGE_KEYS.bottomPanelHeight), BOTTOM_PANEL_DEFAULT_HEIGHT),
      collapsed: get(STORAGE_KEYS.bottomPanelCollapsed) === "true",
      maximized: get(STORAGE_KEYS.bottomPanelMaximized) === "true",
      activeTab: (get(STORAGE_KEYS.bottomPanelTab) as BottomPanelTab) || "terminal",
    },
    agentPanel: {
      width: safeParseInt(get(STORAGE_KEYS.agentPanelWidth), AGENT_PANEL_DEFAULT_WIDTH),
      visible: get(STORAGE_KEYS.showAgentPanel) === "true",
    },
    chat: {
      width: safeParseInt(get(STORAGE_KEYS.chatWidth), CHAT_DEFAULT_WIDTH),
    },
    showChat: get(STORAGE_KEYS.showChat) !== "false",
  };
}

function saveLayoutState(state: LayoutState): void {
  const label = getWindowLabel();
  const set = (key: string, value: string) => {
    localStorage.setItem(`${key}_${label}`, value);
    if (label === "main") localStorage.setItem(key, value);
  };

  set(STORAGE_KEYS.sidebarWidth, state.sidebar.width.toString());
  set(STORAGE_KEYS.sidebarCollapsed, state.sidebar.collapsed.toString());
  set(STORAGE_KEYS.sidebarTab, state.sidebar.activeTab);
  set(STORAGE_KEYS.rightSidebarWidth, state.rightSidebar.width.toString());
  set(STORAGE_KEYS.rightSidebarCollapsed, state.rightSidebar.collapsed.toString());
  set(STORAGE_KEYS.bottomPanelHeight, state.bottomPanel.height.toString());
  set(STORAGE_KEYS.bottomPanelCollapsed, state.bottomPanel.collapsed.toString());
  set(STORAGE_KEYS.bottomPanelMaximized, state.bottomPanel.maximized.toString());
  set(STORAGE_KEYS.bottomPanelTab, state.bottomPanel.activeTab);
  set(STORAGE_KEYS.agentPanelWidth, state.agentPanel.width.toString());
  set(STORAGE_KEYS.showAgentPanel, state.agentPanel.visible.toString());
  set(STORAGE_KEYS.chatWidth, state.chat.width.toString());
  set(STORAGE_KEYS.showChat, state.showChat.toString());
}

function resetLayoutState(): LayoutState {
  const defaultState: LayoutState = {
    sidebar: {
      width: SIDEBAR_DEFAULT_WIDTH,
      collapsed: false,
      activeTab: "files",
    },
    rightSidebar: {
      width: RIGHT_SIDEBAR_DEFAULT_WIDTH,
      collapsed: true,
    },
    bottomPanel: {
      height: BOTTOM_PANEL_DEFAULT_HEIGHT,
      collapsed: true,
      maximized: false,
      activeTab: "terminal",
    },
    agentPanel: {
      width: AGENT_PANEL_DEFAULT_WIDTH,
      visible: false,
    },
    chat: {
      width: CHAT_DEFAULT_WIDTH,
    },
    showChat: true,
  };
  saveLayoutState(defaultState);
  return defaultState;
}

// ============================================================================
// Activity Bar Component (VS Code-style vertical icon bar)
// ============================================================================

interface ActivityBarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  position: "left" | "right";
  badges?: Partial<Record<SidebarTab, number>>;
}

// Activity Bar Item with Tooltip
interface ActivityBarItemProps {
  id: SidebarTab;
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  position: "left" | "right";
  badge?: number;
}

function ActivityBarItem(props: ActivityBarItemProps) {
  const [showTooltip, setShowTooltip] = createSignal(false);
  const [tooltipPosition, setTooltipPosition] = createSignal({ x: 0, y: 0 });
  let buttonRef: HTMLButtonElement | undefined;
  let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleMouseEnter = (_e: MouseEvent) => {
    void _e; // MouseEvent available if needed
    // Delay tooltip show by 500ms
    tooltipTimeout = setTimeout(() => {
      if (buttonRef) {
        const rect = buttonRef.getBoundingClientRect();
        setTooltipPosition({
          x: props.position === "left" ? rect.right + 8 : rect.left - 8,
          y: rect.top + rect.height / 2,
        });
        setShowTooltip(true);
      }
    }, 500);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = null;
    }
    setShowTooltip(false);
  };

  onCleanup(() => {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
    }
  });

  return (
    <>
      <button
        ref={buttonRef}
        onClick={props.onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        class="activity-bar-item flex items-center justify-center relative transition-colors"
        style={{
          // Compact buttons
          width: "30px",
          height: "30px",
          // Active = white icon at 100% opacity, Inactive = white icon at 70% opacity - NO background
          background: "transparent",
          "border-radius": tokens.radius.sm,
          color: props.isActive ? "var(--cortex-text-primary)" : "var(--cortex-text-primary)",
          opacity: props.isActive ? "1" : "0.7",
          border: "none",
          cursor: "pointer",
        }}
        aria-pressed={props.isActive}
        aria-label={props.label}
      >
        {/* Active indicator - 2px left border */}
        <Show when={props.isActive}>
          <div
            style={{
              position: "absolute",
              [props.position === "left" ? "left" : "right"]: "0",
              top: "0",
              bottom: "0",
              width: "2px",
              background: tokens.colors.semantic.primary,
            }}
          />
        </Show>
        
        {/* Icon - 20px */}
        <Icon name={props.icon} size={20} />
        
        {/* Badge */}
        <Show when={(props.badge ?? 0) > 0}>
          <div
            class="absolute flex items-center justify-center"
            style={{
              top: tokens.spacing.md,
              right: tokens.spacing.md,
              width: "16px",
              height: "16px",
              "min-width": "16px",
              background: tokens.colors.semantic.primary,
              color: tokens.colors.text.inverse,
              "font-size": tokens.typography.fontSize.sm,
              "font-weight": "bold",
              "border-radius": tokens.radius.md,
              "line-height": "1",
            }}
          >
            {(props.badge ?? 0) > 99 ? "99+" : props.badge}
          </div>
        </Show>
      </button>
      
      {/* Tooltip Portal */}
      <Show when={showTooltip()}>
        <div
          class="fixed z-[10000] pointer-events-none"
          style={{
            left: props.position === "left" ? `${tooltipPosition().x}px` : "auto",
            right: props.position === "right" ? `calc(100vw - ${tooltipPosition().x}px)` : "auto",
            top: `${tooltipPosition().y}px`,
            transform: "translateY(-50%)",
          }}
        >
          <div
            style={{
              background: tokens.colors.surface.panel,
              color: tokens.colors.text.primary,
              "font-size": tokens.typography.fontSize.base,
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              "border-radius": tokens.radius.md,
              "box-shadow": "0 2px 8px rgba(0,0,0,0.3)",
              "white-space": "nowrap",
            }}
          >
            {props.label}
          </div>
        </div>
      </Show>
    </>
  );
}
// Silence unused warning for ActivityBarItem (reserved for enhanced tooltip feature)
void ActivityBarItem;

function ActivityBar(props: ActivityBarProps) {
  // Activity bar tabs configuration
  const tabs: Array<{ id: SidebarTab; icon: string; label: string }> = [
    { id: "files", icon: "folder", label: "Explorer" },
    { id: "search", icon: "magnifying-glass", label: "Search" },
    { id: "git", icon: "code-branch", label: "Source Control" },
    { id: "debug", icon: "play", label: "Run & Debug" },
    { id: "extensions", icon: "box", label: "Extensions" },
    { id: "agents", icon: "users", label: "Agents" },
    { id: "factory", icon: "grid", label: "Agent Factory" },
    { id: "wiki", icon: "book-open", label: "Wiki" },
    { id: "codemap", icon: "map", label: "Code Map" },
    { id: "design", icon: "pen-fancy", label: "Design" },
  ];

  // Note: props.sidebarCollapsed and props.activeTab are evaluated fresh on each click
  // because we call props.onToggleSidebar which re-renders the parent
  const handleTabClick = (tabId: SidebarTab) => {
    // Special case: Factory mode switches to full-screen factory view
    if (tabId === "factory") {
      window.dispatchEvent(new CustomEvent("viewmode:change", { 
        detail: { mode: "factory" } 
      }));
      return;
    }

    // If we're in factory mode and clicking another item, switch back to IDE mode
    const currentMode = localStorage.getItem("cortex_view_mode");
    if (currentMode === "factory") {
      window.dispatchEvent(new CustomEvent("viewmode:change", { 
        detail: { mode: "ide" } 
      }));
    }

    // Always read current values from props at click time
    const isCollapsed = props.sidebarCollapsed;
    const currentTab = props.activeTab;
    
    if (isCollapsed) {
      // Sidebar is collapsed - expand it and switch to the clicked tab
      props.onToggleSidebar();
      props.onTabChange(tabId);
    } else if (currentTab === tabId) {
      // Clicking the active tab - collapse the sidebar
      props.onToggleSidebar();
    } else {
      // Switching to a different tab
      props.onTabChange(tabId);
    }
  };

  return (
    <aside
      class="shrink-0 flex flex-col h-full"
      style={{ 
        // Compact activity bar width
        width: "30px",
        // Glassmorphism: Transparent to inherit from .layout
        // Margin left and right for spacing
        "margin-left": "3px",
        "margin-right": "3px",
      }}
    >
      {/* Icons - JetBrains compact: reduced padding */}
      <div class="flex flex-col items-center pt-1 gap-0.5">
        {/* Tab icons */}
        <For each={tabs}>
          {(tab) => {
            const isActive = () => props.activeTab === tab.id && !props.sidebarCollapsed;
            return (
              <button 
                class="flex items-center justify-center rounded transition-colors"
                onClick={() => handleTabClick(tab.id)}
                title={tab.label}
                style={{
                  width: "30px",
                  height: "30px",
                  background: isActive() ? "rgba(255, 255, 255, 0.12)" : "transparent",
                  color: "var(--cortex-text-primary)",
                  opacity: isActive() ? "1" : "0.7",
                  transition: "background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease",
                }}
                onMouseEnter={(e) => { 
                  e.currentTarget.style.color = "var(--cortex-text-primary)"; 
                  e.currentTarget.style.opacity = "1"; 
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                }}
                onMouseLeave={(e) => { 
                  if (!isActive()) { 
                    e.currentTarget.style.color = "var(--cortex-text-primary)"; 
                    e.currentTarget.style.opacity = "0.7"; 
                    e.currentTarget.style.background = "transparent";
                  } else {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                  }
                }}
              >
                <Icon name={tab.icon} size={20} />
              </button>
            );
          }}
        </For>
      </div>
    </aside>
  );
}

// ============================================================================
// Right Activity Bar Component (for Chat toggle)
// ============================================================================

interface RightActivityBarProps {
  showChat: boolean;
  onToggleChat: () => void;
}

function RightActivityBar(props: RightActivityBarProps) {
  return (
    <aside
      class="shrink-0 flex flex-col h-full"
      style={{ 
        width: "40px",
        "margin-left": "3px",
        "margin-right": "3px",
      }}
    >
      <div class="flex flex-col items-center pt-1 gap-0.5">
        <button 
          class="w-9 h-9 flex items-center justify-center rounded transition-colors"
          onClick={props.onToggleChat}
          title={props.showChat ? "Hide Chat (Ctrl+Shift+C)" : "Show Chat (Ctrl+Shift+C)"}
          style={{
            background: props.showChat ? "rgba(255, 255, 255, 0.12)" : "transparent",
            color: "var(--cortex-text-primary)",
            opacity: props.showChat ? "1" : "0.7",
            transition: "background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease",
          }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.color = "var(--cortex-text-primary)"; 
            e.currentTarget.style.opacity = "1"; 
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
          }}
          onMouseLeave={(e) => { 
            if (!props.showChat) { 
              e.currentTarget.style.color = "var(--cortex-text-primary)"; 
              e.currentTarget.style.opacity = "0.7"; 
              e.currentTarget.style.background = "transparent";
            } else {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

// ============================================================================
// Sidebar Panel Component
// ============================================================================

interface SidebarPanelProps {
  isCollapsed: boolean;
  width: number;
  activeTab: SidebarTab;
  position: "left" | "right";
  activityBarLocation: ActivityBarLocation;
  onToggle: () => void;
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onTabChange: (tab: SidebarTab) => void;
  projectPath: string | null;
  onFileSelect: (filePath: string) => void;
  onFilePreview?: (filePath: string) => void; // Opens file in preview mode
  onNewSession: () => void;
  onTogglePosition: () => void;
  isResizing?: boolean;
}

function SidebarPanel(props: SidebarPanelProps) {
  // SDK state available for future use
  useSDK();
  // Terminals state available for future use  
  useTerminals();
  const { state: previewState, openPreview } = usePreview();

  const [showContextMenu, setShowContextMenu] = createSignal(false);
  const [contextMenuPos, setContextMenuPos] = createSignal({ x: 0, y: 0 });
  
  // State for "New..." dropdown menu in explorer toolbar
  const [showNewMenu, setShowNewMenu] = createSignal(false);
  const [newMenuPos, setNewMenuPos] = createSignal({ x: 0, y: 0 });

  // When activity bar is on side, it's rendered separately; otherwise embedded in sidebar
  const showActivityBar = () => props.activityBarLocation === "side";
  const currentWidth = () => {
    if (props.isCollapsed) {
      // When collapsed and activity bar is on side, show 0 width (activity bar handles it)
      // When activity bar is top/hidden, show 0
      return 0;
    }
    // Ensure minimum width when expanded
    return Math.max(props.width, SIDEBAR_MIN_WIDTH);
  };

  // Handle right-click on header for context menu (available for future use)
  const _handleHeaderContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };
  void _handleHeaderContextMenu; // Silence unused warning

  // Close context menu when clicking outside
  useEventListener("click", () => setShowContextMenu(false), { target: document });

  // Determine collapse icon based on position
  const CollapseIcon = () => {
    const iconName = props.position === "left" ? "chevron-left" : "chevron-right";
    return <Icon name={iconName} size={14} />;
  };

// Sidebar tabs configuration - JetBrains-style activity bar
  const sidebarTabs: Array<{ id: SidebarTab; icon: string; label: string }> = [
    { id: "files", icon: "folder", label: "Project" },
    { id: "search", icon: "magnifying-glass", label: "Search" },
    { id: "git", icon: "code-branch", label: "Source Control" },
    { id: "debug", icon: "play", label: "Run & Debug" },
    { id: "extensions", icon: "box", label: "Extensions" },
    { id: "agents", icon: "users", label: "Agents" },
    { id: "outline", icon: "list", label: "Outline" },
  ];

  return (
    <aside
      class="sidebar-panel h-full shrink-0 flex flex-col"
      style={{
        position: "relative",
        width: `${currentWidth()}px`,
        "min-width": props.isCollapsed ? "0" : "180px",
        transition: props.isResizing ? "none" : "width 150ms ease",
        // Glassmorphism: Inherit from html background (no explicit background)
        "border-radius": tokens.radius.lg, // 12px - consistent with all cards
        // JetBrains spec: NO heavy borders on sidebar panel, use color contrast only
      }}
      data-panel-id="sidebar"
      data-position={props.position}
    >
      {/* Compact Horizontal Icon Bar at Top - Only show when activityBarLocation is NOT "side" */}
      <Show when={!showActivityBar()}>
        <div 
          class="shrink-0 flex items-center gap-0.5 px-2"
          style={{ 
            height: "28px",
            // JetBrains spec: NO heavy borders, use color contrast only
          }}
        >
          <For each={sidebarTabs.slice(0, 4)}>
            {(tab) => {
              const isSelected = () => props.activeTab === tab.id;
              return (
                <button
                  onClick={() => props.onTabChange(tab.id)}
                  class="flex items-center justify-center rounded transition-colors"
                  style={{
                    width: "24px",
                    height: "24px",
                    background: "transparent",
                    color: isSelected() ? "var(--cortex-text-primary)" : tokens.colors.icon.inactive,
                    opacity: isSelected() ? "1" : "0.7",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--cortex-text-primary)";
                    e.currentTarget.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected()) {
                      e.currentTarget.style.color = tokens.colors.icon.inactive;
                      e.currentTarget.style.opacity = "0.7";
                    }
                  }}
                  title={tab.label}
                >
                  <Icon name={tab.icon} size={14} />
                </button>
              );
            }}
          </For>
          {/* Spacer */}
          <div class="flex-1" />
          {/* Collapse button */}
          <button
            onClick={props.onToggle}
            class="flex items-center justify-center rounded transition-colors"
            style={{ 
              width: "20px",
              height: "20px",
              color: tokens.colors.icon.default,
              background: "transparent",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            title="Collapse sidebar"
          >
            <CollapseIcon />
          </button>
        </div>
      </Show>

      {/* Content Panel - Only show when sidebar is expanded */}
      <Show when={!props.isCollapsed}>
        <div 
          class="card-surface"
          style={{ 
            flex: "1 1 0",
            display: "flex",
            "flex-direction": "column",
            "min-height": "0",
            overflow: "hidden",
            // Flush content: no padding, content touches sidebar edges
          }}
        >
          {/* Section Header - Trae style: show for all tabs (except search/codemap which have their own) */}
          <Show when={props.activeTab !== "search" && props.activeTab !== "codemap"}>
            <div 
              class="shrink-0 flex items-center justify-between"
              style={{ 
                height: "28px",
                "min-height": "28px",
                "padding-left": "12px",
                "padding-right": "8px",
              }}
            >
              <span 
                class="font-semibold"
                style={{ 
                  "font-size": tokens.typography.fontSize.sm,
                  "font-family": "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                  "letter-spacing": "normal",
                  color: tokens.colors.text.muted,
                }}
              >
                {sidebarTabs.find(t => t.id === props.activeTab)?.label || "Explorer"}
              </span>
              {/* Actions for Explorer - consolidated toolbar */}
              <Show when={props.activeTab === "files"}>
                <div class="flex items-center gap-0.5">
                  {/* Search toggle */}
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("fileexplorer:toggle-search"))}
                    class="flex items-center justify-center rounded transition-colors"
                    style={{ 
                      width: "20px",
                      height: "20px",
                      color: tokens.colors.text.muted,
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.background = tokens.colors.interactive.hover;
                      e.currentTarget.style.color = tokens.colors.text.primary;
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = tokens.colors.text.muted;
                    }}
                    title="Filter files (Ctrl+Shift+F)"
                  >
                    <Icon name="magnifying-glass" size={14} />
                  </button>
                  {/* New... dropdown button */}
                  <button
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setNewMenuPos({ x: rect.left, y: rect.bottom + 4 });
                      setShowNewMenu(true);
                    }}
                    class="flex items-center justify-center rounded transition-colors"
                    style={{ 
                      width: "20px",
                      height: "20px",
                      color: tokens.colors.text.muted,
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.background = tokens.colors.interactive.hover;
                      e.currentTarget.style.color = tokens.colors.text.primary;
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = tokens.colors.text.muted;
                    }}
                    title="New..."
                  >
                    <Icon name="plus" size={14} />
                  </button>
                  {/* Refresh */}
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("fileexplorer:refresh"))}
                    class="flex items-center justify-center rounded transition-colors"
                    style={{ 
                      width: "20px",
                      height: "20px",
                      color: tokens.colors.text.muted,
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.background = tokens.colors.interactive.hover;
                      e.currentTarget.style.color = tokens.colors.text.primary;
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = tokens.colors.text.muted;
                    }}
                    title="Refresh"
                  >
                    <Icon name="rotate" size={14} />
                  </button>
                  {/* Collapse all */}
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("fileexplorer:collapse-all"))}
                    class="flex items-center justify-center rounded transition-colors"
                    style={{ 
                      width: "20px",
                      height: "20px",
                      color: tokens.colors.text.muted,
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.background = tokens.colors.interactive.hover;
                      e.currentTarget.style.color = tokens.colors.text.primary;
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = tokens.colors.text.muted;
                    }}
                    title="Collapse All"
                  >
                    <Icon name="angles-up" size={14} />
                  </button>
                </div>
              </Show>
            </div>
          </Show>

          {/* Context Menu for sidebar position */}
          <Show when={showContextMenu()}>
            <div
              class="fixed z-50"
              style={{
                left: `${contextMenuPos().x}px`,
                top: `${contextMenuPos().y}px`,
                "min-width": "180px",
                background: tokens.colors.surface.panel,
                border: `1px solid ${tokens.colors.border.divider}`,
                "border-radius": tokens.radius.md,
                "box-shadow": tokens.shadows.popup,
                padding: `${tokens.spacing.sm} 0`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                onClick={() => {
                  props.onTogglePosition();
                  setShowContextMenu(false);
                }}
                style={{
                  width: "100%",
                  "justify-content": "flex-start",
                  padding: "6px 12px",
                  "border-radius": "0",
                }}
              >
                Move Sidebar {props.position === "left" ? "Right" : "Left"}
              </Button>
              <div style={{ height: "1px", background: tokens.colors.border.divider, margin: `${tokens.spacing.sm} ${tokens.spacing.md}` }} />
              <Button
                variant="ghost"
                onClick={() => {
                  props.onToggle();
                  setShowContextMenu(false);
                }}
                style={{
                  width: "100%",
                  "justify-content": "flex-start",
                  padding: "6px 12px",
                  "border-radius": "0",
                }}
              >
                {props.isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              </Button>
            </div>
          </Show>

          {/* Tab Content - Direct children for proper flex behavior, wrapped in error boundaries */}
          {/* All sidebar panels are lazy-loaded for performance */}
          <Show when={props.activeTab === "files"}>
            <SidebarErrorBoundary name="FileExplorer">
              <Suspense fallback={<SidebarSkeleton />}>
                <FileExplorer 
                  rootPath={props.projectPath} 
                  onFileSelect={props.onFileSelect}
                  onFilePreview={props.onFilePreview}
                />
              </Suspense>
            </SidebarErrorBoundary>
          </Show>
          <Show when={props.activeTab === "search"}>
            <SidebarErrorBoundary name="SearchSidebar">
              <Suspense fallback={<SidebarSkeleton />}>
                <div class="flex-1 min-h-0 overflow-auto">
                  <SearchSidebar />
                </div>
              </Suspense>
            </SidebarErrorBoundary>
          </Show>
          <Show when={props.activeTab === "git"}>
            <SidebarErrorBoundary name="GitPanel">
              <Suspense fallback={<SidebarSkeleton />}>
                <div class="flex-1 min-h-0 overflow-auto">
                  <GitPanel />
                </div>
              </Suspense>
            </SidebarErrorBoundary>
          </Show>
          <Show when={props.activeTab === "debug"}>
            <SidebarErrorBoundary name="DebuggerPanel">
              <Suspense fallback={<SidebarSkeleton />}>
                <div class="flex-1 min-h-0 overflow-auto">
                  <DebuggerPanel />
                </div>
              </Suspense>
            </SidebarErrorBoundary>
          </Show>
          <Show when={props.activeTab === "extensions"}>
            <SidebarErrorBoundary name="ExtensionsPanel">
              <Suspense fallback={<SidebarSkeleton />}>
                <div class="flex-1 min-h-0 overflow-auto">
                  <ExtensionsSidebarPanel />
                </div>
              </Suspense>
            </SidebarErrorBoundary>
          </Show>
          <Show when={props.activeTab === "outline"}>
            <SidebarErrorBoundary name="OutlinePanel">
              <Suspense fallback={<SidebarSkeleton />}>
                <div class="flex-1 min-h-0 overflow-auto">
                  <OutlinePanelSidebar />
                </div>
              </Suspense>
            </SidebarErrorBoundary>
          </Show>
          <Show when={props.activeTab === "codemap"}>
            <SidebarErrorBoundary name="CodemapsPanel">
              <Suspense fallback={<SidebarSkeleton />}>
                <div class="flex-1 min-h-0 overflow-auto">
                  <CodemapsSidebar />
                </div>
              </Suspense>
            </SidebarErrorBoundary>
          </Show>
          <Show when={props.activeTab === "agents"}>
            <SidebarErrorBoundary name="AgentsSidebar">
              <Suspense fallback={<SidebarSkeleton />}>
                <div class="flex-1 min-h-0 overflow-auto">
                  <AgentsSidebar />
                </div>
              </Suspense>
            </SidebarErrorBoundary>
          </Show>

          {/* Web Preview Servers - Zed style: 26px items, 12px font, 4px gap */}
          <Show when={previewState.servers.length > 0}>
            <div 
              class="shrink-0 max-h-32 overflow-y-auto"
              style={{ 
                /* JetBrains Islands: No visible borders */
                padding: `${tokens.spacing.md} ${tokens.spacing.sm}`,
              }}
            >
              {/* Section header */}
              <div 
                class="font-medium"
                style={{ 
                  padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                  "font-size": tokens.typography.fontSize.sm,
                  "font-family": "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                  "letter-spacing": "normal",
                  color: tokens.colors.text.primary,
                }}
              >
                Servers
              </div>
              <For each={previewState.servers}>
                {(server) => (
                  <button
                    onClick={() => openPreview(server.url, server.name)}
                    class="w-full flex items-center rounded transition-colors"
                    style={{ 
                      height: "26px",
                      padding: `0 ${tokens.spacing.md}`,
                      gap: tokens.spacing.sm,
                      color: tokens.colors.text.primary,
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <Icon 
                      name="globe" 
                      size={14}
                      class="shrink-0" 
                      style={{ 
                        color: tokens.colors.icon.active,
                      }} 
                    />
                    <span class="truncate font-mono" style={{ "font-size": tokens.typography.fontSize.base }}>:{server.port}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Resize Handle - Positioned absolutely on the right edge */}
      <ResizeHandle
        direction="horizontal"
        onResize={props.onResize}
        onResizeStart={props.onResizeStart}
        onResizeEnd={props.onResizeEnd}
        minSize={SIDEBAR_MIN_WIDTH}
        maxSize={SIDEBAR_MAX_WIDTH}
        style={{
          position: "absolute",
          right: "0",
          top: "0",
          bottom: "0",
          height: "auto",
        }}
      />
      
      {/* New... Context Menu for Explorer toolbar */}
      <ContextMenu
        state={{
          visible: showNewMenu(),
          x: newMenuPos().x,
          y: newMenuPos().y,
          sections: [
            {
              items: [
                { 
                  id: "new-file", 
                  label: "File", 
                  icon: "file", 
                  shortcut: "Ctrl+N",
                  action: () => {
                    window.dispatchEvent(new CustomEvent("fileexplorer:new-file"));
                    setShowNewMenu(false);
                  }
                },
                { 
                  id: "new-folder", 
                  label: "Folder", 
                  icon: "folder",
                  action: () => {
                    window.dispatchEvent(new CustomEvent("fileexplorer:new-folder"));
                    setShowNewMenu(false);
                  }
                },
              ],
            },
            {
              items: [
                { 
                  id: "new-component", 
                  label: "React Component", 
                  icon: "cube",
                  iconColor: "blue",
                  action: () => {
                    window.dispatchEvent(new CustomEvent("fileexplorer:new-file", { detail: { template: "react-component" } }));
                    setShowNewMenu(false);
                  }
                },
                { 
                  id: "new-typescript", 
                  label: "TypeScript File", 
                  icon: "file-code",
                  iconColor: "blue",
                  action: () => {
                    window.dispatchEvent(new CustomEvent("fileexplorer:new-file", { detail: { extension: ".ts" } }));
                    setShowNewMenu(false);
                  }
                },
                { 
                  id: "new-module", 
                  label: "Module (index.ts)", 
                  icon: "box",
                  action: () => {
                    window.dispatchEvent(new CustomEvent("fileexplorer:new-file", { detail: { template: "module" } }));
                    setShowNewMenu(false);
                  }
                },
              ],
            },
            {
              items: [
                { 
                  id: "new-dockerfile", 
                  label: "Dockerfile", 
                  icon: "cube",
                  iconColor: "blue",
                  action: () => {
                    window.dispatchEvent(new CustomEvent("fileexplorer:new-file", { detail: { name: "Dockerfile", template: "dockerfile" } }));
                    setShowNewMenu(false);
                  }
                },
                { 
                  id: "new-docker-compose", 
                  label: "Docker Compose", 
                  icon: "cubes",
                  iconColor: "blue",
                  action: () => {
                    window.dispatchEvent(new CustomEvent("fileexplorer:new-file", { detail: { name: "docker-compose.yml", template: "docker-compose" } }));
                    setShowNewMenu(false);
                  }
                },
                { 
                  id: "new-gitignore", 
                  label: ".gitignore", 
                  icon: "code-branch",
                  iconColor: "orange",
                  action: () => {
                    window.dispatchEvent(new CustomEvent("fileexplorer:new-file", { detail: { name: ".gitignore", template: "gitignore" } }));
                    setShowNewMenu(false);
                  }
                },
                { 
                  id: "new-env", 
                  label: ".env", 
                  icon: "key",
                  iconColor: "yellow",
                  action: () => {
                    window.dispatchEvent(new CustomEvent("fileexplorer:new-file", { detail: { name: ".env", template: "env" } }));
                    setShowNewMenu(false);
                  }
                },
              ],
            },
            {
              items: [
                { 
                  id: "new-readme", 
                  label: "README.md", 
                  icon: "book",
                  action: () => {
                    window.dispatchEvent(new CustomEvent("fileexplorer:new-file", { detail: { name: "README.md", template: "readme" } }));
                    setShowNewMenu(false);
                  }
                },
                { 
                  id: "new-package-json", 
                  label: "package.json", 
                  icon: "box",
                  iconColor: "green",
                  action: () => {
                    window.dispatchEvent(new CustomEvent("fileexplorer:new-file", { detail: { name: "package.json", template: "package-json" } }));
                    setShowNewMenu(false);
                  }
                },
              ],
            },
          ] as ContextMenuSection[],
        }}
        onClose={() => setShowNewMenu(false)}
      />
    </aside>
  );
}

// ============================================================================
// Extensions Sidebar Panel Component
// ============================================================================

function ExtensionsSidebarPanel() {
  return <ExtensionsPanel />;
}

// ============================================================================
// Terminal Bottom Panel Content Component (Embedded with Sidebar)
// ============================================================================

// Terminal list sidebar constants
const TERMINAL_LIST_MIN_WIDTH = 32;
const TERMINAL_LIST_MAX_WIDTH = 350;
const TERMINAL_LIST_DEFAULT_WIDTH = 160;
const TERMINAL_LIST_STORAGE_KEY = "layout_terminal_list_width";

function TerminalBottomPanelContent() {
  const { state: terminalsState, createTerminal, openTerminal, setActiveTerminal, closeTerminal, getTerminalName, getTerminalColor } = useTerminals();
  const [isInitializing, setIsInitializing] = createSignal(false);
  const [terminalListWidth, setTerminalListWidth] = createSignal(
    safeParseInt(localStorage.getItem(TERMINAL_LIST_STORAGE_KEY), TERMINAL_LIST_DEFAULT_WIDTH)
  );
  const [isResizing, setIsResizing] = createSignal(false);
  
  // Save width to localStorage
  createEffect(() => {
    localStorage.setItem(TERMINAL_LIST_STORAGE_KEY, terminalListWidth().toString());
  });
  
  // Show last command when width is large enough (> 150px)
  const showLastCommand = () => terminalListWidth() > 150;
  // Show terminal name when width is medium (> 80px)
  const showTerminalName = () => terminalListWidth() > 80;
  // Show action buttons (close, split) when width allows (> 120px)
  const showActionButtons = () => terminalListWidth() > 120;
  
  // Auto-create terminal on mount if none exist
  onMount(async () => {
    if (terminalsState.terminals.length === 0 && !isInitializing()) {
      setIsInitializing(true);
      try {
        const terminal = await createTerminal();
        openTerminal(terminal.id);
      } catch (e) {
        console.error("Failed to create terminal:", e);
      } finally {
        setIsInitializing(false);
      }
    }
  });

  const handleNewTerminal = async () => {
    try {
      const terminal = await createTerminal();
      openTerminal(terminal.id);
    } catch (e) {
      console.error("Failed to create terminal:", e);
    }
  };
  
  const handleResize = (delta: number) => {
    setTerminalListWidth(w => Math.max(TERMINAL_LIST_MIN_WIDTH, Math.min(TERMINAL_LIST_MAX_WIDTH, w - delta)));
  };

  return (
    <div class="h-full flex">
      {/* Main terminal area - takes remaining space */}
      <div class="flex-1 min-w-0 h-full relative" style={{ background: tokens.colors.surface.canvas }}>
        <Show 
          when={!isInitializing() && terminalsState.terminals.length > 0}
          fallback={
            <div class="h-full flex items-center justify-center">
              <Show when={isInitializing()}>
                <div class="flex items-center gap-2" style={{ color: tokens.colors.text.primary, "font-size": tokens.typography.fontSize.base }}>
                  <Icon name="terminal" size={16} class="animate-pulse" />
                  <span>Starting terminal...</span>
                </div>
              </Show>
            </div>
          }
        >
          {/* Terminal content will be rendered by the floating TerminalPanel */}
          <div 
            class="absolute inset-0"
            data-terminal-embed="true"
            data-active-terminal={terminalsState.activeTerminalId}
          />
        </Show>
      </div>

      {/* Right sidebar - terminal list (resizable) */}
      <div 
        class="shrink-0 flex h-full"
        style={{ 
          width: `${terminalListWidth()}px`,
          transition: isResizing() ? "none" : "width 150ms ease",
        }}
      >
        {/* Resize Handle */}
        <ResizeHandle
          direction="horizontal"
          onResize={handleResize}
          onResizeStart={() => setIsResizing(true)}
          onResizeEnd={() => setIsResizing(false)}
          minSize={TERMINAL_LIST_MIN_WIDTH}
          maxSize={TERMINAL_LIST_MAX_WIDTH}
        />
        
        <div 
          class="flex-1 flex flex-col h-full overflow-hidden"
          style={{ background: tokens.colors.surface.panel }}
        >
          {/* Terminal list header */}
          <div 
            class="shrink-0 flex items-center"
            style={{ 
              height: "28px", 
              "min-height": "28px",
              "justify-content": showTerminalName() ? "space-between" : "center",
              padding: showTerminalName() ? "4px 8px" : "4px",
            }}
          >
            <Show when={showTerminalName()}>
              <span 
                class="font-medium truncate" 
                style={{ 
                  color: tokens.colors.text.muted, 
                  "font-size": "11px",
                  "font-family": "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                  "letter-spacing": "normal",
                }}
              >
                Terminals
              </span>
            </Show>
            <IconButton
              size="sm"
              variant="ghost"
              onClick={handleNewTerminal}
              tooltip="New Terminal"
            >
              <Icon name="plus" size={14} />
            </IconButton>
          </div>

          {/* Terminal list */}
          <div class="flex-1 overflow-y-auto">
            <For each={terminalsState.terminals}>
              {(terminal, index) => {
                const isActive = () => terminal.id === terminalsState.activeTerminalId;
                const [hovered, setHovered] = createSignal(false);
                
                // Get display info
                const terminalNumber = () => index() + 1;
                const lastCommand = () => terminal.last_command || "";
                const displayName = () => getTerminalName(terminal.id) || terminal.name || `Terminal ${terminalNumber()}`;
                const terminalColor = () => getTerminalColor(terminal.id);
                
                return (
                  <div
                    class="group flex items-center rounded cursor-pointer"
                    style={{
                      height: "26px",
                      "min-height": "26px",
                      gap: showTerminalName() ? "8px" : "0",
                      padding: showTerminalName() ? "0 8px" : "0 4px",
                      margin: showTerminalName() ? "0 4px" : "0 2px",
                      "justify-content": showTerminalName() ? "flex-start" : "center",
                      background: isActive() ? tokens.colors.interactive.selected : hovered() ? tokens.colors.interactive.hover : "transparent",
                      color: isActive() ? tokens.colors.text.primary : tokens.colors.text.secondary,
                      transition: "background 0.1s ease",
                    }}
                    onClick={() => setActiveTerminal(terminal.id)}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                  >
                    {/* Terminal icon with custom color indicator */}
                    <div class="shrink-0 relative" style={{ width: "14px", height: "14px" }}>
                      <Icon 
                        name="terminal"
                        size={14}
                        style={{ 
                          color: terminalColor() || (isActive() ? tokens.colors.icon.active : tokens.colors.icon.default),
                        }} 
                      />
                      {/* Color indicator dot */}
                      <Show when={terminalColor()}>
                        <div 
                          style={{ 
                            position: "absolute",
                            bottom: "-2px",
                            right: "-2px",
                            width: "6px",
                            height: "6px",
                            "border-radius": "var(--cortex-radius-full)",
                            background: terminalColor()!,
                            border: `1px solid ${tokens.colors.surface.panel}`,
                          }}
                        />
                      </Show>
                    </div>
                    
                    {/* Terminal info - only show when width allows */}
                    <Show when={showTerminalName()}>
                      <div class="flex-1 min-w-0 flex flex-col justify-center">
                        <Show 
                          when={showLastCommand() && lastCommand()}
                          fallback={
                            <span 
                              class="truncate" 
                              style={{ 
                                "font-size": "12px",
                                "line-height": "1.3",
                              }}
                            >
                              {displayName()}
                            </span>
                          }
                        >
                          {/* When wide enough, show last command as main text */}
                          <span 
                            class="truncate" 
                            style={{ 
                              "font-size": "12px",
                              "line-height": "1.2",
                              "font-family": "var(--font-mono)",
                            }}
                            title={lastCommand()}
                          >
                            {lastCommand()}
                          </span>
                          <span 
                            class="truncate" 
                            style={{ 
                              "font-size": "10px",
                              "line-height": "1.2",
                              color: tokens.colors.text.muted,
                            }}
                          >
                            {displayName()}
                          </span>
                        </Show>
                      </div>
                    </Show>
                    
                    {/* Action buttons - only visible on hover AND when width allows */}
                    <Show when={hovered() && showActionButtons()}>
                      <div class="flex items-center gap-0.5 shrink-0">
                        <IconButton
                          size="sm"
                          variant="ghost"
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Create a new terminal (split effect)
                            try {
                              const newTerminal = await createTerminal();
                              openTerminal(newTerminal.id);
                            } catch (err) {
                              console.error("Failed to split terminal:", err);
                            }
                          }}
                          tooltip="Split Terminal"
                        >
                          <Icon name="columns" size={14} />
                        </IconButton>
                        <IconButton
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTerminal(terminal.id);
                          }}
                          tooltip="Close Terminal"
                        >
                          <Icon name="trash" size={14} />
                        </IconButton>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Ports Bottom Panel Content Component
// ============================================================================

function PortsBottomPanelContent() {
  return (
    <div class="h-full flex items-center justify-center">
      <div class="text-center" style={{ color: tokens.colors.text.primary }}>
        <Icon name="globe" size={32} class="mx-auto mb-2 opacity-50" />
        <p style={{ "font-size": tokens.typography.fontSize.base }}>No forwarded ports</p>
        <p class="mt-1" style={{ color: tokens.colors.icon.default, "font-size": tokens.typography.fontSize.sm }}>
          Forward a port to access it from your browser
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Layout Component
// ============================================================================

// ============================================================================
// Bottom Panel Tab Button
// ============================================================================

interface BottomTabButtonProps {
  id: BottomPanelTab;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}

function BottomTabButton(props: BottomTabButtonProps) {
  const [hovered, setHovered] = createSignal(false);
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={props.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: props.active ? "var(--cortex-bg-primary)" : hovered() ? "var(--cortex-bg-hover)" : "transparent",
        color: props.active ? "var(--cortex-text-primary)" : hovered() ? "var(--cortex-text-primary)" : tokens.colors.text.muted,
        "font-weight": props.active ? "500" : "400",
        "border-radius": tokens.radius.sm,
        padding: "6px 12px",
        height: "28px",
        "min-width": "auto",
        border: "none",
      }}
    >
      {props.label}
      <Show when={(props.badge ?? 0) > 0}>
        <span 
          style={{
            "margin-left": "8px",
            padding: "2px 6px",
            "border-radius": tokens.radius.sm,
            background: tokens.colors.semantic.primary,
            color: tokens.colors.text.inverse,
            "font-size": "11px",
            "font-weight": "500",
            "min-width": "18px",
            "text-align": "center",
          }}
        >
          {(props.badge ?? 0) > 99 ? "99+" : props.badge}
        </span>
      </Show>
    </Button>
  );
}

// ============================================================================
// Bottom Panel Component
// ============================================================================

interface BottomPanelProps {
  isCollapsed: boolean;
  isMaximized: boolean;
  height: number;
  width?: number;
  activeTab: BottomPanelTab;
  position: "bottom" | "left" | "right";
  alignment: "center" | "left" | "right" | "justify";
  onToggle: () => void;
  onMaximize: () => void;
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onTabChange: (tab: BottomPanelTab) => void;
  onDoubleClickHandle: () => void;
  isResizing?: boolean;
}

function BottomPanel(props: BottomPanelProps) {
  const { state: previewState } = usePreview();

  // Determine current size based on position
  const currentHeight = (): number => {
    if (props.isCollapsed) return 0;
    if (props.position !== "bottom") return 0; // Not used for side panels (they use full height)
    if (props.isMaximized) return window.innerHeight - 100; // Leave room for menu/status bar
    return props.height;
  };

  const currentWidth = (): number => {
    if (props.isCollapsed) return 0;
    if (props.position === "bottom") return 0; // Not used for bottom panel
    return props.width || 300; // Default width for side panels
  };

  // Determine if panel is horizontal (left/right) or vertical (bottom)
  const isHorizontal = () => props.position === "left" || props.position === "right";

  // Get border style based on position
  // JetBrains Islands: NO visible borders - use gaps instead
  const getBorderStyle = () => {
    return {}; // No borders - panels float with gaps
  };

  // Get content alignment style (mainly for bottom position)
  const getAlignmentStyle = () => {
    if (props.position !== "bottom") return {};
    switch (props.alignment) {
      case "left":
        return { "justify-content": "flex-start" };
      case "right":
        return { "justify-content": "flex-end" };
      case "justify":
        return { "justify-content": "stretch" };
      case "center":
      default:
        return { "justify-content": "center" };
    }
  };

  const showPreviewTab = () => previewState.showPreview && previewState.activeServer;

  // Bottom panel tabs - VS Code style order
  const bottomTabs: Array<{ id: BottomPanelTab; icon: string; label: string; badge?: number }> = [
    { id: "debug-console", icon: "play", label: "Debug Console" },
    { id: "terminal", icon: "terminal", label: "Terminal" },
    { id: "ports", icon: "globe", label: "Ports" },
  ];

  return (
    <Show when={!props.isCollapsed}>
      <div
        class={`bottom-panel flex shrink-0 overflow-hidden ${isHorizontal() ? "flex-col h-full" : "flex-col"}`}
        style={{
          ...(isHorizontal() 
            ? { width: `${currentWidth()}px`, "min-width": `${SIDEBAR_MIN_WIDTH}px` }
            : { height: `${currentHeight()}px`, "min-height": props.isMaximized ? undefined : `${BOTTOM_PANEL_MIN_HEIGHT}px` }
          ),
          transition: props.isResizing ? "none" : (isHorizontal() ? "width 150ms ease" : "height 150ms ease"),
          ...getBorderStyle(),
          background: tokens.colors.surface.panel,
        }}
      >
        {/* Resize Handle */}
        <div 
          onDblClick={props.onDoubleClickHandle}
          style={{ cursor: isHorizontal() ? "col-resize" : "row-resize" }}
        >
          <ResizeHandle
            direction={isHorizontal() ? "horizontal" : "vertical"}
            onResize={(delta) => props.onResize(isHorizontal() ? (props.position === "left" ? delta : -delta) : -delta)}
            onResizeStart={props.onResizeStart}
            onResizeEnd={props.onResizeEnd}
            minSize={isHorizontal() ? SIDEBAR_MIN_WIDTH : BOTTOM_PANEL_MIN_HEIGHT}
            maxSize={isHorizontal() ? SIDEBAR_MAX_WIDTH : BOTTOM_PANEL_MAX_HEIGHT}
          />
        </div>

        {/* Header with tabs */}
        <div
          class="shrink-0 flex items-center px-2"
          style={{
            height: `${PANEL_HEADER_HEIGHT}px`,
            "min-height": `${PANEL_HEADER_HEIGHT}px`,
            background: tokens.colors.surface.panel,
            /* JetBrains Islands: No visible borders */
          }}
        >
          {/* Tab buttons */}
          <div class="flex items-center gap-2">
            <For each={bottomTabs}>
              {(tab) => (
                <BottomTabButton
                  id={tab.id}
                  icon={tab.icon}
                  label={tab.label}
                  active={props.activeTab === tab.id}
                  badge={tab.badge}
                  onClick={() => props.onTabChange(tab.id)}
                />
              )}
            </For>
            <Show when={showPreviewTab()}>
              <BottomTabButton
                id="preview"
                icon="globe"
                label="Preview"
                active={props.activeTab === "preview"}
                onClick={() => props.onTabChange("preview")}
              />
            </Show>
          </div>

          <div class="flex-1" />

          {/* Panel actions */}
          <div class="flex items-center gap-0.5">
            <button
              onClick={props.onMaximize}
              class="p-1.5 rounded transition-colors"
              style={{ color: tokens.colors.icon.default }}
              onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              title={props.isMaximized ? "Restore panel" : "Maximize panel"}
            >
              {props.isMaximized ? (
                <Icon name="minimize" size={14} />
              ) : (
                <Icon name="maximize" size={14} />
              )}
            </button>
            <button
              onClick={props.onToggle}
              class="p-1.5 rounded transition-colors"
              style={{ color: tokens.colors.icon.default }}
              onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              title="Close panel (Ctrl+J)"
            >
              <Icon name="xmark" size={14} />
            </button>
          </div>
        </div>

        {/* Content - wrapped in error boundaries to isolate failures */}
        <div 
          class="flex-1 min-h-0 overflow-hidden"
          style={{ background: tokens.colors.surface.canvas, ...getAlignmentStyle() }}
        >
          <Show when={props.activeTab === "debug-console"}>
            <EditorErrorBoundary name="DebugConsole">
              <Suspense fallback={<div class="h-full flex items-center justify-center"><Icon name="terminal" size={24} class="animate-pulse opacity-50" /></div>}>
                <DebugConsole />
              </Suspense>
            </EditorErrorBoundary>
          </Show>
          <Show when={props.activeTab === "terminal"}>
            <EditorErrorBoundary name="Terminal">
              <TerminalBottomPanelContent />
            </EditorErrorBoundary>
          </Show>
          <Show when={props.activeTab === "ports"}>
            <PortsBottomPanelContent />
          </Show>
          <Show when={props.activeTab === "preview" && showPreviewTab()}>
            <Suspense fallback={<div class="h-full flex items-center justify-center"><Icon name="globe" size={24} class="animate-pulse opacity-50" /></div>}>
              <div class="h-full">
                <WebPreview />
              </div>
            </Suspense>
          </Show>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Right Sidebar Component (Optional)
// ============================================================================

interface RightSidebarProps {
  isCollapsed: boolean;
  width: number;
  onToggle: () => void;
  onResize: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  isResizing?: boolean;
}

// RightSidebar component (reserved for future auxiliary bar feature)
function _RightSidebar(props: RightSidebarProps) {
  const currentWidth = () => props.isCollapsed ? 0 : props.width;

  return (
    <Show when={!props.isCollapsed}>
      <aside
        class="right-sidebar h-full shrink-0 flex"
        style={{
          width: `${currentWidth()}px`,
          transition: props.isResizing ? "none" : "width 150ms ease",
          /* JetBrains Islands: No visible borders */
        }}
      >
        {/* Resize Handle */}
        <ResizeHandle
          direction="horizontal"
          onResize={(delta) => props.onResize(-delta)}
          onResizeStart={props.onResizeStart}
          onResizeEnd={props.onResizeEnd}
          minSize={RIGHT_SIDEBAR_MIN_WIDTH}
          maxSize={RIGHT_SIDEBAR_MAX_WIDTH}
        />

        <div 
          class="flex-1 flex flex-col overflow-hidden"
          style={{ background: tokens.colors.surface.panel }}
        >
          {/* Header */}
          <div 
            class="shrink-0 flex items-center justify-between px-3"
            style={{ 
              height: `${PANEL_HEADER_HEIGHT}px`,
              "min-height": `${PANEL_HEADER_HEIGHT}px`,
              /* JetBrains Islands: No visible borders */
            }}
          >
            <span 
              class="font-medium"
              style={{ 
                "font-size": tokens.typography.fontSize.sm,
                "font-family": "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                "letter-spacing": "normal",
                color: tokens.colors.text.primary,
              }}
            >
              Outline
            </span>
            <button
              onClick={props.onToggle}
              class="flex items-center justify-center rounded transition-colors"
              style={{ 
                width: "24px",
                height: "24px",
                color: tokens.colors.icon.default,
                background: "transparent",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              title="Close panel"
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </div>

          {/* Content */}
          <div class="flex-1 min-h-0 overflow-hidden">
            <SidebarErrorBoundary name="OutlinePanel (Right)">
              <OutlinePanelSidebar />
            </SidebarErrorBoundary>
          </div>
        </div>
      </aside>
    </Show>
  );
}
void _RightSidebar; // Silence unused warning

// ============================================================================
// Main Layout Component
// ============================================================================

export function Layout(props: ParentProps) {
  const { destroySession } = useSDK();
  const { state: previewState } = usePreview();
  const { openFile, openPreview: editorOpenPreview, state: editorState, setActiveGroup } = useEditor();
  const navigate = useNavigate();
  const { state: settingsState, effectiveSettings, updateThemeSetting } = useSettings();
  const { state: zenModeState, actions: zenModeActions } = useZenMode();
  const workspace = useWorkspace();

  // Load initial layout state
  const initialState = loadLayoutState();

  // Zen mode settings
  const zenSettings = () => effectiveSettings()?.zenMode;
  const isZenMode = () => zenModeState()?.active ?? false;
  
  // Check if any folder is open (using workspace context for reliability)
  const hasOpenFolder = () => {
    const folders = workspace?.folders() || [];
    return folders.length > 0;
  };
  
  // Computed visibility based on zen mode and project state
  // Note: shouldHideSidebar, shouldCenterLayout, zenMaxWidth are defined for future zen mode enhancements
  const _shouldHideSidebar = () => (isZenMode() && zenSettings()?.hideSidebar) || !hasOpenFolder();
  void _shouldHideSidebar; // Reserved for future zen mode implementation
  const shouldHideStatusBar = () => (isZenMode() && zenSettings()?.hideStatusBar) || !hasOpenFolder();
  const shouldHideMenuBar = () => isZenMode() && zenSettings()?.hideMenuBar;
  const shouldHidePanel = () => (isZenMode() && zenSettings()?.hidePanel) || !hasOpenFolder() || isFactoryMode();
  const _shouldCenterLayout = () => isZenMode() && zenSettings()?.centerLayout;
  void _shouldCenterLayout; // Reserved for future zen mode implementation
  const _zenMaxWidth = () => zenSettings()?.maxWidth || "900px";
  void _zenMaxWidth; // Reserved for future zen mode implementation

  // Sidebar position from settings
  const sidebarPosition = () => settingsState.settings?.theme?.sidebarPosition ?? "left";
  
  // Activity bar location from settings (side | top | hidden)
  // Default to "side" for vertical activity bar like Welcome page
  const activityBarLocation = () => settingsState.settings?.theme?.activityBarPosition ?? "side";
  
  // Menu bar visibility from settings (classic | compact | toggle | hidden)
  const menuBarVisibility = () => settingsState.settings?.theme?.menuBarVisibility ?? "classic";
  
  // Panel position from settings (bottom | left | right)
  const panelPosition = () => settingsState.settings?.theme?.panelPosition ?? "bottom";
  
  // Panel alignment from settings (center | left | right | justify)
  const panelAlignment = () => settingsState.settings?.theme?.panelAlignment ?? "center";
  
  // State for Alt key pressed (used for toggle/hidden menu bar modes)
  const [altKeyPressed, setAltKeyPressed] = createSignal(false);
  
  // Computed: should menu bar be visible based on menuBarVisibility setting
  const shouldShowMenuBar = () => {
    if (shouldHideMenuBar()) return false; // Zen mode override
    if (isVibeMode()) return false; // Hide menu bar in Vibe mode
    
    const visibility = menuBarVisibility();
    switch (visibility) {
      case "classic":
        return true;
      case "compact":
        return true; // Always visible, just compact style
      case "toggle":
        return altKeyPressed();
      case "hidden":
        return altKeyPressed();
      default:
        return true;
    }
  };
  
  // Is menu bar in compact mode
  const isMenuBarCompact = () => menuBarVisibility() === "compact";

  // View mode state (Vibe vs IDE vs Factory)
  const VIEW_MODE_KEY = "cortex_view_mode";
  type ViewMode = "vibe" | "ide" | "factory";
  const [viewMode, setViewMode] = createSignal<ViewMode>(
    (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "vibe"
  );
  
  // Listen for view mode changes from MenuBar
  useCustomEvent<{ mode: ViewMode }>("viewmode:change", (detail) => {
    setViewMode(detail.mode);
    localStorage.setItem(VIEW_MODE_KEY, detail.mode);
  });
  
  // In Vibe mode, hide file explorer and other IDE tools (but keep collapsed sidebar for conversations)
  const isVibeMode = () => viewMode() === "vibe";
  const isFactoryMode = () => viewMode() === "factory";

  // Toggle sidebar position handler
  const handleToggleSidebarPosition = async () => {
    const newPosition = sidebarPosition() === "left" ? "right" : "left";
    await updateThemeSetting("sidebarPosition", newPosition);
  };

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(initialState.sidebar.collapsed);
  const [sidebarWidth, setSidebarWidth] = createSignal(initialState.sidebar.width);
  const [sidebarTab, setSidebarTab] = createSignal<SidebarTab>(initialState.sidebar.activeTab);

  // Right sidebar state
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = createSignal(initialState.rightSidebar.collapsed);
  const [rightSidebarWidth, setRightSidebarWidth] = createSignal(initialState.rightSidebar.width);

  // Agent panel state
  const [showAgentPanel, setShowAgentPanel] = createSignal(initialState.agentPanel.visible);
  const [agentPanelWidth, setAgentPanelWidth] = createSignal(initialState.agentPanel.width);
  // Agent panel collapse state (reserved for future collapsible agent panel feature)
  const [_agentPanelCollapsed, _setAgentPanelCollapsed] = createSignal(false);
  void _agentPanelCollapsed; void _setAgentPanelCollapsed;
  const _AGENT_PANEL_COLLAPSED_WIDTH = 48;
  void _AGENT_PANEL_COLLAPSED_WIDTH;

  // Bottom panel state
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = createSignal(initialState.bottomPanel.collapsed);
  const [bottomPanelHeight, setBottomPanelHeight] = createSignal(initialState.bottomPanel.height);
  const [bottomPanelMaximized, setBottomPanelMaximized] = createSignal(initialState.bottomPanel.maximized);
  const [bottomPanelTab, setBottomPanelTab] = createSignal<BottomPanelTab>(initialState.bottomPanel.activeTab);

  // Chat state
  const [showChat, setShowChat] = createSignal(initialState.showChat);
  const [chatWidth, setChatWidth] = createSignal(initialState.chat.width);

  // Layout presets state
  const [activePresetId, setActivePresetIdState] = createSignal<string | null>(getActivePresetId());
  // Custom presets (reserved for user-defined layout presets feature)
  const [_customPresets, _setCustomPresets] = createSignal<LayoutPreset[]>(loadCustomPresets());
  void _customPresets; void _setCustomPresets;

  // Get current layout state for saving presets
  const getCurrentLayoutState = (): PresetLayoutState => ({
    sidebar: {
      width: sidebarWidth(),
      collapsed: sidebarCollapsed(),
      activeTab: sidebarTab(),
    },
    rightSidebar: {
      width: rightSidebarWidth(),
      collapsed: rightSidebarCollapsed(),
    },
    bottomPanel: {
      height: bottomPanelHeight(),
      collapsed: bottomPanelCollapsed(),
      maximized: bottomPanelMaximized(),
      activeTab: bottomPanelTab(),
    },
    agentPanel: {
      width: agentPanelWidth(),
      visible: showAgentPanel(),
    },
    chat: {
      width: chatWidth(),
    },
    showChat: showChat(),
  });

  // Apply a layout preset
  const applyLayoutPreset = (preset: LayoutPreset) => {
    batch(() => {
      setSidebarCollapsed(preset.state.sidebar.collapsed);
      setSidebarWidth(preset.state.sidebar.width);
      setSidebarTab(preset.state.sidebar.activeTab as SidebarTab);
      setRightSidebarCollapsed(preset.state.rightSidebar.collapsed);
      setRightSidebarWidth(preset.state.rightSidebar.width);
      setBottomPanelCollapsed(preset.state.bottomPanel.collapsed);
      setBottomPanelHeight(preset.state.bottomPanel.height);
      setBottomPanelMaximized(preset.state.bottomPanel.maximized);
      setBottomPanelTab(preset.state.bottomPanel.activeTab as BottomPanelTab);
      setShowAgentPanel(preset.state.agentPanel.visible);
      setAgentPanelWidth(preset.state.agentPanel.width);
      setChatWidth(preset.state.chat.width);
      setShowChat(preset.state.showChat);
    });
    setActivePresetIdState(preset.id);
    setActivePresetId(preset.id);
  };

  // Handle active preset change (just tracking, no applying)
  const handleActivePresetChange = (presetId: string | null) => {
    setActivePresetIdState(presetId);
    setActivePresetId(presetId);
  };

  // Project path
  const [projectPath, setProjectPath] = createSignal<string | null>(null);

  // Signal backend that UI shell is ready - show the window immediately
  // This must be the first onMount to ensure window appears as soon as Layout renders
  onMount(() => {
    invoke("show_window").catch(console.error);
  });

  // Load project path
  onMount(() => {
    const label = getWindowLabel();
    
    // 1. Check URL parameters first (important for session restoration)
    const params = new URLSearchParams(window.location.search);
    const urlProject = params.get("project");
    
    if (urlProject) {
      setProjectPath(urlProject);
      localStorage.setItem(`cortex_current_project_${label}`, urlProject);
      return;
    }

    // 2. Fallback to localStorage - only for this specific window
    // New windows should NOT inherit main window's project
    const stored = localStorage.getItem(`cortex_current_project_${label}`);
    // Only use legacy key for main window
    const legacyStored = label === "main" ? localStorage.getItem("cortex_current_project") : null;
    
    if (stored || legacyStored) {
      setProjectPath(stored || legacyStored);
    }
  });

  // Watch for project changes via event (immediate) and localStorage polling (fallback)
  createEffect(() => {
    // Listen for workspace:open-folder event for immediate updates
    const handleOpenFolder = (e: CustomEvent<{ path: string }>) => {
      const newPath = e.detail?.path;
      if (newPath && newPath !== projectPath()) {
        setProjectPath(newPath);
        // Also update localStorage for persistence
        const label = getWindowLabel();
        localStorage.setItem(`cortex_current_project_${label}`, newPath);
        if (label === "main") {
          localStorage.setItem("cortex_current_project", newPath);
        }
      }
    };
    
    window.addEventListener("workspace:open-folder", handleOpenFolder as EventListener);
    
    // Fallback: poll localStorage for changes from external sources
    const checkProject = () => {
      const label = getWindowLabel();
      const stored = localStorage.getItem(`cortex_current_project_${label}`);
      // Only use legacy key for main window
      const legacyStored = label === "main" ? localStorage.getItem("cortex_current_project") : null;
      const effectiveStored = stored || legacyStored;
        
      if (effectiveStored !== projectPath()) {
        setProjectPath(effectiveStored);
      }
    };
    const interval = setInterval(checkProject, 500);
    
    return () => {
      window.removeEventListener("workspace:open-folder", handleOpenFolder as EventListener);
      clearInterval(interval);
    };
  });

  // Watch for project changes and sync with backend for session restore
  createEffect(() => {
    const path = projectPath();
    const label = getWindowLabel();
    invoke("register_window_project", { label, path }).catch(console.error);
  });

  onCleanup(() => {
    const _label = getWindowLabel();
    void _label;
    // Use a small delay or a fire-and-forget to notify backend of closure
    // Note: unregister_window might need to be called on actual window close event from Tauri
    // but doing it here helps when component is unmounted.
  });

  // Save layout state when any value changes - debounced to avoid excessive writes
  let saveLayoutTimer: ReturnType<typeof setTimeout> | null = null;
  createEffect(() => {
    const layoutState: LayoutState = {
      sidebar: {
        width: sidebarWidth(),
        collapsed: sidebarCollapsed(),
        activeTab: sidebarTab(),
      },
      rightSidebar: {
        width: rightSidebarWidth(),
        collapsed: rightSidebarCollapsed(),
      },
      bottomPanel: {
        height: bottomPanelHeight(),
        collapsed: bottomPanelCollapsed(),
        maximized: bottomPanelMaximized(),
        activeTab: bottomPanelTab(),
      },
      agentPanel: {
        width: agentPanelWidth(),
        visible: showAgentPanel(),
      },
      chat: {
        width: chatWidth(),
      },
      showChat: showChat(),
    };
    // Debounce localStorage writes to prevent performance issues
    if (saveLayoutTimer) clearTimeout(saveLayoutTimer);
    saveLayoutTimer = setTimeout(() => saveLayoutState(layoutState), 100);
  });
  
  onCleanup(() => {
    if (saveLayoutTimer) clearTimeout(saveLayoutTimer);
  });

  // Auto-show bottom panel when preview is shown
  createEffect(() => {
    if (previewState.showPreview) {
      setBottomPanelCollapsed(false);
      setBottomPanelTab("preview");
    }
  });

  // ========================================================================
  // Menu Event Handlers
  // ========================================================================
  
  // Zoom handlers
  const handleZoomIn = () => {
    const webview = document.body;
    const currentZoom = parseFloat(webview.style.zoom || '1');
    webview.style.zoom = String(Math.min(currentZoom + 0.1, 2));
    localStorage.setItem('cortex_zoom', webview.style.zoom);
  };

  const handleZoomOut = () => {
    const webview = document.body;
    const currentZoom = parseFloat(webview.style.zoom || '1');
    webview.style.zoom = String(Math.max(currentZoom - 0.1, 0.5));
    localStorage.setItem('cortex_zoom', webview.style.zoom);
  };

  const handleZoomReset = () => {
    document.body.style.zoom = '1';
    localStorage.setItem('cortex_zoom', '1');
  };

  // Fullscreen handler
  const handleToggleFullscreen = async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    const isFullscreen = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!isFullscreen);
  };

  // Terminal split handler
  const handleTerminalSplit = () => {
    window.dispatchEvent(new CustomEvent('terminal:split-current'));
  };

  // DevTools handler
  const handleToggleDevTools = async () => {
    try {
      await invoke('toggle_devtools');
    } catch (e) {
      console.error('Failed to toggle devtools:', e);
    }
  };

  // Restore zoom on load
  onMount(() => {
    const savedZoom = localStorage.getItem('cortex_zoom');
    if (savedZoom) {
      document.body.style.zoom = savedZoom;
    }
  });

  // Main keyboard handler for shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+B: Toggle sidebar
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
      e.preventDefault();
      setSidebarCollapsed(!sidebarCollapsed());
    }
    // Ctrl+J: Toggle bottom panel
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
      e.preventDefault();
      if (bottomPanelCollapsed()) {
        setBottomPanelCollapsed(false);
      } else {
        setBottomPanelCollapsed(true);
        setBottomPanelMaximized(false);
      }
    }
    // Ctrl+Shift+E: Focus file explorer
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "e") {
      e.preventDefault();
      setSidebarCollapsed(false);
      setSidebarTab("files");
    }
    // Ctrl+Shift+G: Focus git panel
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "g") {
      e.preventDefault();
      setSidebarCollapsed(false);
      setSidebarTab("git");
    }
    // Ctrl+Shift+D: Focus debug panel
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      setSidebarCollapsed(false);
      setSidebarTab("debug");
    }
    // Ctrl+Shift+X: Focus extensions panel
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "x") {
      e.preventDefault();
      setSidebarCollapsed(false);
      setSidebarTab("extensions");
    }
    // Ctrl+Shift+O: Focus outline panel
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      setSidebarCollapsed(false);
      setSidebarTab("outline");
    }
    // Ctrl+Shift+F: Focus search panel (common IDE shortcut)
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setSidebarCollapsed(false);
      setSidebarTab("search");
    }
    // Focus editor groups: Ctrl+1, Ctrl+2, etc.
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key >= "1" && e.key <= "9") {
      const groupIndex = parseInt(e.key) - 1;
      const groups = editorState.groups;
      if (groupIndex < groups.length) {
        e.preventDefault();
        setActiveGroup(groups[groupIndex].id);
      }
    }
    // Ctrl+Shift+C: Toggle chat
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      setShowChat(!showChat());
    }
    // Ctrl+Shift+A: Toggle agent panel
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setShowAgentPanel(!showAgentPanel());
    }
    // Ctrl+Shift+Y: Toggle Factory mode
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "y") {
      e.preventDefault();
      const newMode = isFactoryMode() ? "ide" : "factory";
      window.dispatchEvent(new CustomEvent("viewmode:change", { 
        detail: { mode: newMode } 
      }));
    }
    // Escape: Exit maximized panel
    if (e.key === "Escape" && bottomPanelMaximized()) {
      e.preventDefault();
      setBottomPanelMaximized(false);
    }
    // Ctrl+= or Ctrl++: Zoom in
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      handleZoomIn();
    }
    // Ctrl+-: Zoom out
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "-") {
      e.preventDefault();
      handleZoomOut();
    }
    // Ctrl+0: Zoom reset
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "0") {
      e.preventDefault();
      handleZoomReset();
    }
    // F11: Toggle fullscreen
    if (e.key === "F11") {
      e.preventDefault();
      handleToggleFullscreen();
    }
  };

  // Reset layout command handler
  const handleResetLayout = () => {
    const newState = resetLayoutState();
    batch(() => {
      setSidebarCollapsed(newState.sidebar.collapsed);
      setSidebarWidth(newState.sidebar.width);
      setSidebarTab(newState.sidebar.activeTab);
      setRightSidebarCollapsed(newState.rightSidebar.collapsed);
      setRightSidebarWidth(newState.rightSidebar.width);
      setBottomPanelCollapsed(newState.bottomPanel.collapsed);
      setBottomPanelHeight(newState.bottomPanel.height);
      setBottomPanelMaximized(newState.bottomPanel.maximized);
      setBottomPanelTab(newState.bottomPanel.activeTab);
      setShowAgentPanel(newState.agentPanel.visible);
      setAgentPanelWidth(newState.agentPanel.width);
      setChatWidth(newState.chat.width);
      setShowChat(newState.showChat);
    });
  };

  // Sidebar toggle handlers
  const handleToggleSidebarEvent = () => setSidebarCollapsed(!sidebarCollapsed());
  const handleToggleSidebarPositionEvent = () => handleToggleSidebarPosition();
  
  // Chat and agent panel toggle handlers
  const handleToggleChatEvent = () => setShowChat(!showChat());
  const handleToggleAgentPanelEvent = () => setShowAgentPanel(!showAgentPanel());
  
  // Terminal handlers
  const handleTerminalToggle = () => {
    if (bottomPanelCollapsed()) {
      setBottomPanelCollapsed(false);
      setBottomPanelTab("terminal");
    } else if (bottomPanelTab() === "terminal") {
      setBottomPanelCollapsed(true);
    } else {
      setBottomPanelTab("terminal");
    }
  };
  
  const handleTerminalNew = () => {
    setBottomPanelCollapsed(false);
    setBottomPanelTab("terminal");
  };
  
  // Alt key handlers for menu bar toggle/hidden modes
  const handleAltKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Alt") setAltKeyPressed(true);
  };
  
  const handleAltKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Alt") setAltKeyPressed(false);
  };
  
  // Blur handler to reset Alt state when window loses focus
  const handleWindowBlur = () => setAltKeyPressed(false);

  // ========================================================================
  // Event Listeners using useEventListener hooks
  // ========================================================================
  
  // Keyboard event listeners (use individual hooks for proper typing)
  useEventListener("keydown", handleKeyDown);
  useEventListener("keydown", handleAltKeyDown);
  useEventListener("keyup", handleAltKeyUp);
  useEventListener("blur", handleWindowBlur);
  
  // Layout and sidebar event listeners
  useEventListeners([
    { type: "reset-layout", handler: handleResetLayout },
    { type: "sidebar:toggle-position", handler: handleToggleSidebarPositionEvent },
    { type: "sidebar:toggle", handler: handleToggleSidebarEvent },
    { type: "view:toggle-chat", handler: handleToggleChatEvent },
    { type: "view:toggle-agent-panel", handler: handleToggleAgentPanelEvent },
  ]);
  
  // Terminal event listeners
  useEventListeners([
    { type: "terminal:toggle", handler: handleTerminalToggle },
    { type: "terminal:new", handler: handleTerminalNew },
    { type: "terminal:split", handler: handleTerminalSplit },
  ]);
  
  // Zoom and fullscreen event listeners
  useEventListeners([
    { type: "view:zoom-in", handler: handleZoomIn },
    { type: "view:zoom-out", handler: handleZoomOut },
    { type: "view:zoom-reset", handler: handleZoomReset },
    { type: "view:toggle-fullscreen", handler: handleToggleFullscreen },
    { type: "dev:toggle-devtools", handler: handleToggleDevTools },
  ]);
  
  // View focus event listener (typed custom event)
  useCustomEvent<{ view: string; type: "sidebar" | "panel" }>("view:focus", (detail) => {
    if (!detail) return;
    const { view, type } = detail;
    if (type === "sidebar") {
      setSidebarCollapsed(false);
      setSidebarTab(view as SidebarTab);
    } else if (type === "panel") {
      setBottomPanelCollapsed(false);
      setBottomPanelTab(view as BottomPanelTab);
    }
  });

  const handleNewSession = async () => {
    await destroySession();
    navigate("/session");
  };

  const handleFileSelect = (filePath: string) => {
    openFile(filePath);
  };

  // Handle file preview (single-click in explorer with preview mode enabled)
  const handleFilePreview = (filePath: string) => {
    editorOpenPreview(filePath);
  };

  // Track dragging state to disable transitions during resize
  const [isResizing, setIsResizing] = createSignal(false);

  const handleSidebarResize = (delta: number) => {
    setSidebarWidth(w => Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, w + delta)));
  };

  // Right sidebar resize handler (reserved for future use)
  const _handleRightSidebarResize = (delta: number) => {
    setRightSidebarWidth(w => Math.max(RIGHT_SIDEBAR_MIN_WIDTH, Math.min(RIGHT_SIDEBAR_MAX_WIDTH, w + delta)));
  };
  void _handleRightSidebarResize;

  const handleBottomPanelResize = (delta: number) => {
    setBottomPanelHeight(h => Math.max(BOTTOM_PANEL_MIN_HEIGHT, Math.min(BOTTOM_PANEL_MAX_HEIGHT, h + delta)));
  };

  const handleBottomPanelToggle = () => {
    if (bottomPanelMaximized()) {
      setBottomPanelMaximized(false);
    }
    setBottomPanelCollapsed(!bottomPanelCollapsed());
  };

  const handleBottomPanelMaximize = () => {
    setBottomPanelMaximized(!bottomPanelMaximized());
  };

  const handleBottomPanelHandleDoubleClick = () => {
    setBottomPanelHeight(BOTTOM_PANEL_DEFAULT_HEIGHT);
  };

  // Agent panel resize handler (reserved for future use)
  const _handleAgentPanelResize = (delta: number) => {
    setAgentPanelWidth(w => Math.max(AGENT_PANEL_MIN_WIDTH, Math.min(AGENT_PANEL_MAX_WIDTH, w + delta)));
  };
  void _handleAgentPanelResize;

  const handleChatResize = (delta: number) => {
    setChatWidth(w => Math.max(CHAT_MIN_WIDTH, Math.min(CHAT_MAX_WIDTH, w - delta)));
  };

  const hasOpenFiles = () => editorState.openFiles.length > 0;

  // Global dragover handler to prevent "no-drop" cursor when dragging files internally
  const handleGlobalDragOver = (e: DragEvent) => {
    // Check if this is an internal drag (has Cortex paths data)
    // We need to allow the drag to continue so it doesn't show "no-drop" cursor
    const types = e.dataTransfer?.types || [];
    const isInternalDrag = types.includes("application/x-cortex-paths") || 
                           types.includes("text/plain");
    
    if (isInternalDrag) {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
    }
  };

  return (
      <div 
        class="layout h-full flex flex-col"
        style={{ 
          // Glassmorphism: Single tinted background on layout container
          // All children (navbar, sidebar, gaps, panels) inherit this uniformly
          background: "var(--glass-ui-bg)",
        }}
        data-zen-mode={isZenMode() ? "true" : "false"}
        onDragOver={handleGlobalDragOver}
      >
        {/* Menu Bar - visibility controlled by menuBarVisibility setting, with animation */}
        <div 
          style={{
            height: shouldShowMenuBar() ? "41px" : "0px",
            opacity: shouldShowMenuBar() ? "1" : "0",
            overflow: shouldShowMenuBar() ? "visible" : "hidden",
            transition: "height 250ms ease-out, opacity 200ms ease-out",
          }}
        >
          <Suspense fallback={<div style={{ height: "41px", background: tokens.colors.surface.panel }} />}>
            <MenuBar compact={isMenuBarCompact()} />
          </Suspense>
        </div>
        
        {/* Agent Factory Mode - Full screen view with Activity Bar */}
        <Show when={isFactoryMode()}>
          <div class="flex-1 flex min-h-0 overflow-hidden" style={{ gap: tokens.spacing.sm }}>
            {/* Activity Bar in Factory mode */}
            <Show when={activityBarLocation() === "side" && hasOpenFolder()}>
              <ActivityBar
                activeTab={sidebarTab()}
                onTabChange={setSidebarTab}
                onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed())}
                sidebarCollapsed={sidebarCollapsed()}
                position={sidebarPosition()}
              />
            </Show>
            <div class="flex-1 min-h-0 overflow-hidden" style={{ padding: tokens.spacing.sm }}>
              <Suspense fallback={<div class="h-full flex items-center justify-center"><Icon name="grid" size={32} class="animate-pulse opacity-50" /></div>}>
                <AgentFactory />
              </Suspense>
            </div>
          </div>
        </Show>

        {/* Main content area - row layout (hidden in Factory mode) */}
        <div 
          class="flex-1 flex min-h-0 overflow-hidden" 
          style={{ 
            "padding-right": tokens.spacing.sm,
            display: isFactoryMode() ? "none" : "flex",
          }}
        >
          {/* Activity Bar - Full height, always shown when activityBarLocation is "side" (even when sidebar collapsed) */}
          <Show when={activityBarLocation() === "side" && !isVibeMode() && hasOpenFolder()}>
            <ActivityBar
              activeTab={sidebarTab()}
              onTabChange={setSidebarTab}
              onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed())}
              sidebarCollapsed={sidebarCollapsed()}
              position={sidebarPosition()}
            />
          </Show>

          {/* Column: (Sidebar card + Editor side by side) + Bottom Panel underneath both */}
          <div 
            class="flex flex-col min-h-0 overflow-hidden"
            style={{
              display: isVibeMode() ? "none" : "flex",
              // Grow only when editor has files open, otherwise just fit content (sidebar width)
              "flex-grow": hasOpenFiles() ? "1" : "0",
              "flex-shrink": hasOpenFiles() ? "1" : "0",
              // When sidebar collapsed and no files, take no space
              width: (sidebarCollapsed() && !hasOpenFiles()) ? "0px" : "auto",
              transition: "width 250ms ease-out, flex-grow 250ms ease-out",
              // No margin between activity bar and sidebar
              "margin-left": "0",
            }}
          >
            {/* Top row: Sidebar card + Editor side by side */}
            <div 
              class="flex min-h-0 overflow-hidden" 
              style={{ 
                gap: tokens.spacing.sm,
                // Always grow to fill space - sidebar needs height even without files
                "flex-grow": "1",
                "flex-shrink": "1",
                // Margin bottom for consistent spacing with other cards
                "margin-bottom": "4px",
                // No padding/margin on left
                "padding-left": "0",
                "margin-left": "0",
              }}
            >
              {/* Sidebar content card - always rendered when folder is open, width controlled by sidebarCollapsed */}
              <Show when={hasOpenFolder()}>
                <div 
                  style={{
                    width: sidebarCollapsed() ? "0px" : `${sidebarWidth()}px`,
                    "min-width": sidebarCollapsed() ? "0px" : `${SIDEBAR_MIN_WIDTH}px`,
                    transition: "width 250ms ease-out, min-width 250ms ease-out",
                    height: "100%",
                    overflow: "hidden",
                    "margin-left": "0",
                    "padding-left": "0",
                  }}
                >
                  <SidebarPanel
                    isCollapsed={sidebarCollapsed()}
                    width={sidebarWidth()}
                    activeTab={sidebarTab()}
                    position={sidebarPosition()}
                    activityBarLocation={activityBarLocation()}
                    onToggle={() => setSidebarCollapsed(!sidebarCollapsed())}
                    onResize={handleSidebarResize}
                    onResizeStart={() => setIsResizing(true)}
                    onResizeEnd={() => setIsResizing(false)}
                    onTabChange={setSidebarTab}
                    projectPath={projectPath()}
                    onFileSelect={handleFileSelect}
                    onFilePreview={handleFilePreview}
                    onNewSession={handleNewSession}
                    onTogglePosition={handleToggleSidebarPosition}
                    isResizing={isResizing()}
                  />
                </div>
              </Show>

              {/* Editor - Lazy loaded (Monaco is ~2MB) */}
              <div 
                class="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden"
                style={{
                  display: hasOpenFiles() ? "flex" : "none",
                  "border-radius": tokens.radius.lg, // 12px - consistent with all cards
                }}
              >
                <EditorErrorBoundary name="Editor">
                  <Suspense fallback={<EditorSkeleton />}>
                    <EditorPanel />
                  </Suspense>
                </EditorErrorBoundary>
              </div>
            </div>

          </div>

          <Show when={hasOpenFiles() && showChat() && !isVibeMode()}>
            <ResizeHandle
              direction="horizontal"
              onResize={handleChatResize}
              onResizeStart={() => setIsResizing(true)}
              onResizeEnd={() => setIsResizing(false)}
              minSize={CHAT_MIN_WIDTH}
              maxSize={CHAT_MAX_WIDTH}
            />
          </Show>

          {/* Chat area - placeholder to reserve space in flex layout */}
          <div
            style={{
              display: (isVibeMode() || !hasOpenFiles() || !showChat()) ? "none" : "block",
              width: `${chatWidth()}px`,
              "flex-shrink": "0",
            }}
          />
          
          {/* Chat area - positioned to extend full height */}
          <main
            class="flex flex-col overflow-hidden"
            style={{
              // Position absolutely when we have files + chat visible (to extend past bottom panel)
              position: (hasOpenFiles() && showChat() && !isVibeMode()) ? "absolute" : "relative",
              top: (hasOpenFiles() && showChat() && !isVibeMode()) ? "48px" : "auto", // Below menu bar
              right: (hasOpenFiles() && showChat() && !isVibeMode()) ? "50px" : "auto", // 40px activity bar + 6px margins + 4px spacing
              bottom: (hasOpenFiles() && showChat() && !isVibeMode()) ? "30px" : "auto", // Above status bar (22px) + margin (8px) for rounded corners
              width: (hasOpenFiles() && showChat() && !isVibeMode()) ? `${chatWidth()}px` : "auto",
              // In Vibe mode: take 100%
              // No open files (IDE mode): flex-grow to fill remaining space after sidebar
              "flex-grow": isVibeMode() ? "0" : (hasOpenFiles() ? "0" : "1"),
              "flex-shrink": "0",
              "flex-basis": isVibeMode() 
                ? "100%"
                : (hasOpenFiles() ? "0" : "auto"),
              "min-width": isVibeMode() ? "100%" : "0",
              "max-width": "100%",
              "border-radius": isVibeMode() ? "0" : tokens.radius.lg, // No rounded corners in Vibe mode
              opacity: (!isVibeMode() && !showChat()) ? "0" : "1",
              visibility: (!isVibeMode() && !showChat()) ? "hidden" : "visible",
              "pointer-events": (!isVibeMode() && !showChat()) ? "none" : "auto",
              transition: isResizing() ? "none" : "opacity 150ms ease-out, visibility 150ms ease-out",
              "z-index": "10",
            }}
          >
          {props.children}
          </main>

          {/* Right Activity Bar - Chat toggle */}
          <Show when={!isVibeMode() && hasOpenFiles()}>
            <RightActivityBar
              showChat={showChat()}
              onToggleChat={() => setShowChat(!showChat())}
            />
          </Show>

          {/* Auxiliary Bar (Secondary Sidebar) - VS Code style */}
          <Show when={!isVibeMode() && hasOpenFolder()}>
            <Suspense fallback={null}>
              <AuxiliaryBar 
                currentFilePath={editorState.openFiles.find(f => f.id === editorState.activeFileId)?.path}
              />
            </Suspense>
          </Show>
        </div>

        {/* Bottom Panel - Aligned with sidebar card, stops before chat panel */}
        <Show when={panelPosition() === "bottom" && !shouldHidePanel() && !bottomPanelCollapsed()}>
          <div
            style={{
              height: `${bottomPanelHeight()}px`,
              "min-height": `${BOTTOM_PANEL_MIN_HEIGHT}px`,
              overflow: "hidden",
              transition: `height ${tokens.transitions.normal} ease-out`,
              "margin-top": tokens.spacing.sm,
              // Align exactly with sidebar card - activity bar (40px) + gap (4px) = 44px
              "margin-left": (activityBarLocation() === "side" && hasOpenFolder() && !isVibeMode()) 
                ? "44px"
                : tokens.spacing.sm,
              // Align with editor right edge - chat width + right activity bar (46px) + gap
              "margin-right": (showChat() && hasOpenFiles() && !isVibeMode())
                ? `${chatWidth() + 62}px`
                : (hasOpenFiles() && !isVibeMode()) ? "50px" : tokens.spacing.sm,
              // Margin bottom for rounded corners visibility (8px to match other cards)
              "margin-bottom": "8px",
            }}
          >
            <BottomPanel
              isCollapsed={bottomPanelCollapsed()}
              isMaximized={bottomPanelMaximized()}
              height={bottomPanelHeight()}
              width={sidebarWidth()}
              activeTab={bottomPanelTab()}
              position={panelPosition()}
              alignment={panelAlignment()}
              onToggle={handleBottomPanelToggle}
              onMaximize={handleBottomPanelMaximize}
              onResize={handleBottomPanelResize}
              onResizeStart={() => setIsResizing(true)}
              onResizeEnd={() => setIsResizing(false)}
              onTabChange={setBottomPanelTab}
              onDoubleClickHandle={handleBottomPanelHandleDoubleClick}
              isResizing={isResizing()}
            />
          </div>
        </Show>

        {/* Toggle bottom panel button - hidden in zen mode, Vibe mode, or Factory mode */}
        <Show when={bottomPanelCollapsed() && !isZenMode() && !isVibeMode() && !isFactoryMode()}>
          <Button
            variant="secondary"
            onClick={() => setBottomPanelCollapsed(false)}
            class="fixed bottom-14 left-1/2 -translate-x-1/2 z-40"
            icon={<Icon name="chevron-up" size={16} />}
            style={{
              "border-radius": tokens.radius.full,
              "box-shadow": tokens.shadows.popup,
              background: tokens.colors.surface.panel,
              border: `1px solid ${tokens.colors.border.divider}`,
            }}
            title="Show panel (Ctrl+J)"
          >
            Panel
          </Button>
        </Show>

        {/* Layout Presets Menu - positioned in top-right corner, hidden in zen mode and vibe mode */}
        <Show when={!isZenMode() && !isVibeMode() && hasOpenFolder()}>
          <div
            class="fixed z-50"
            style={{
              top: shouldShowMenuBar() ? "49px" : "8px",
              right: "8px",
              transition: "top 250ms ease-out",
            }}
          >
            <LayoutPresetsMenu
              activePresetId={activePresetId()}
              currentState={getCurrentLayoutState()}
              onApplyPreset={applyLayoutPreset}
              onActivePresetChange={handleActivePresetChange}
            />
          </div>
        </Show>

        {/* Zen Mode Exit Button - only visible in zen mode */}
        <Show when={isZenMode()}>
          <ZenModeExitButton onExit={zenModeActions.exit} />
        </Show>

        {/* Status Bar - animated for zen mode and Vibe mode */}
          <div
            style={{
              height: (shouldHideStatusBar() || isVibeMode()) ? "0" : "auto",
              opacity: (shouldHideStatusBar() || isVibeMode()) ? "0" : "1",
              overflow: "hidden",
              transition: "height 250ms ease-out, opacity 200ms ease-out",
            }}
          >
            <StatusBar />
          </div>
      </div>
  );
}

// ============================================================================
// Zen Mode Exit Button Component
// ============================================================================

interface ZenModeExitButtonProps {
  onExit: () => void;
}

function ZenModeExitButton(props: ZenModeExitButtonProps) {
  const [visible, setVisible] = createSignal(true);
  const [hovered, setHovered] = createSignal(false);
  
  // Auto-hide after 3 seconds of inactivity, show on mouse move
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  
  const resetHideTimer = () => {
    setVisible(true);
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
    hideTimeout = setTimeout(() => {
      if (!hovered()) {
        setVisible(false);
      }
    }, 3000);
  };
  
  // Initialize hide timer on mount
  onMount(() => {
    resetHideTimer();
  });
  
  // Cleanup timeout on unmount
  onCleanup(() => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
  });
  
  // Mouse move listener to reset hide timer
  useEventListener("mousemove", () => resetHideTimer(), { target: document });
  
  return (
    <Button
      variant="ghost"
      onClick={props.onExit}
      onMouseEnter={() => {
        setHovered(true);
        setVisible(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        resetHideTimer();
      }}
      icon={<Icon name="sun" size={16} />}
      class="fixed top-4 right-4 z-[9999]"
      style={{
        background: hovered() ? tokens.colors.surface.panel : "rgba(0, 0, 0, 0.4)",
        color: hovered() ? tokens.colors.text.primary : "rgba(255, 255, 255, 0.8)",
        border: `1px solid ${tokens.colors.border.divider}`,
        "backdrop-filter": "blur(8px)",
        opacity: visible() ? "1" : "0",
        transform: visible() ? "translateY(0)" : "translateY(-8px)",
        "pointer-events": visible() ? "auto" : "none",
        "box-shadow": tokens.shadows.popup,
        transition: `all ${tokens.transitions.slow} ease`,
      }}
      title="Exit Zen Mode (Press Escape twice)"
    >
      Exit Zen Mode
    </Button>
  );
}

