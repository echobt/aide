/**
 * CortexDesktopLayout - Production layout connecting Figma components to Cortex contexts
 * 
 * This replaces the old Layout.tsx with pixel-perfect Figma design implementation.
 * Connects to: EditorContext, SDKContext, TerminalsContext, SettingsContext, etc.
 */

import {
  JSX,
  ParentProps,
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  Show,
  For,
  lazy,
  Suspense,
} from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

// Figma Components
import CortexTitleBar from "./CortexTitleBar";
import CortexActivityBar from "./CortexActivityBar";
import CortexChatPanel, { ChatPanelState, ChatMessage } from "./CortexChatPanel";
import { CortexAgentSidebar, Agent } from "./CortexAgentSidebar";
import { CortexChangesPanel, FileChange } from "./CortexChangesPanel";
import { CortexConversationView, Message } from "./CortexConversationView";

// Existing Contexts
import { useEditor } from "@/context/EditorContext";
import { useSDK } from "@/context/SDKContext";

// Cortex-styled sidebar panels
import { CortexGitPanel } from "./CortexGitPanel";
import { CortexSearchPanel } from "./CortexSearchPanel";
import { CortexDebugPanel } from "./CortexDebugPanel";
import { CortexExtensionsPanel } from "./CortexExtensionsPanel";

// Lazy load heavy panels
const AgentPanel = lazy(() => import("@/components/ai/AgentPanel").then(m => ({ default: m.AgentPanel })));
const AgentFactory = lazy(() => import("@/components/factory/AgentFactory").then(m => ({ default: m.AgentFactory })));

// Monaco editor wrapper
const EditorPanel = lazy(() => import("@/components/editor/EditorPanel").then(m => ({ default: m.EditorPanel })));

// Real file explorer
const RealFileExplorer = lazy(() => import("@/components/FileExplorer").then(m => ({ default: m.FileExplorer })));

// ============================================================================
// Types
// ============================================================================

type SidebarTab = "files" | "search" | "git" | "debug" | "extensions" | "agents" | "factory";
type ViewMode = "vibe" | "ide";

interface LayoutState {
  mode: ViewMode;
  sidebarTab: SidebarTab;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  chatState: ChatPanelState;
  isDarkMode: boolean;
}

// Storage keys
const STORAGE_KEYS = {
  mode: "figma_layout_mode",
  sidebarTab: "figma_layout_sidebar_tab",
  sidebarCollapsed: "figma_layout_sidebar_collapsed",
  sidebarWidth: "figma_layout_sidebar_width",
  chatState: "figma_layout_chat_state",
} as const;

// ============================================================================
// Layout State Persistence
// ============================================================================

function loadLayoutState(): LayoutState {
  return {
    mode: (localStorage.getItem(STORAGE_KEYS.mode) as ViewMode) || "vibe", // Default to Vibe mode
    sidebarTab: (localStorage.getItem(STORAGE_KEYS.sidebarTab) as SidebarTab) || "files",
    sidebarCollapsed: localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "true",
    sidebarWidth: parseInt(localStorage.getItem(STORAGE_KEYS.sidebarWidth) || "317", 10),
    chatState: (localStorage.getItem(STORAGE_KEYS.chatState) as ChatPanelState) || "minimized",
    isDarkMode: true, // Always dark for Figma design
  };
}

function saveLayoutState(state: Partial<LayoutState>): void {
  if (state.mode !== undefined) localStorage.setItem(STORAGE_KEYS.mode, state.mode);
  if (state.sidebarTab !== undefined) localStorage.setItem(STORAGE_KEYS.sidebarTab, state.sidebarTab);
  if (state.sidebarCollapsed !== undefined) localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(state.sidebarCollapsed));
  if (state.sidebarWidth !== undefined) localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(state.sidebarWidth));
  if (state.chatState !== undefined) localStorage.setItem(STORAGE_KEYS.chatState, state.chatState);
}

// ============================================================================
// Sidebar Panel Skeleton
// ============================================================================

function SidebarSkeleton() {
  return (
    <div style={{
      flex: "1",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
    }}>
      <div style={{
        width: "24px",
        height: "24px",
        border: "2px solid currentColor",
        "border-top-color": "transparent",
        "border-radius": "var(--cortex-radius-full)",
        animation: "spin 0.8s linear infinite",
      }} />
    </div>
  );
}

// ============================================================================
// Empty Explorer - Shown when no folder is open
// ============================================================================

function EmptyExplorer(props: { onOpenFolder: () => void }) {
  return (
    <div style={{
      flex: "1",
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      padding: "24px",
      gap: "16px",
      color: "var(--cortex-text-inactive)",
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      <p style={{
        "font-family": "'Inter', sans-serif",
        "font-size": "14px",
        "text-align": "center",
        margin: "0",
      }}>
        No folder opened
      </p>
      <button
        onClick={props.onOpenFolder}
        style={{
          padding: "8px 16px",
          background: "var(--cortex-accent-primary)",
          border: "none",
          "border-radius": "var(--cortex-radius-md)",
          "font-family": "'Inter', sans-serif",
          "font-size": "13px",
          "font-weight": "500",
          color: "var(--cortex-text-primary)",
          cursor: "pointer",
        }}
      >
        Open Folder
      </button>
    </div>
  );
}

// ============================================================================
// Figma Menu Dropdown - Hamburger menu with Figma theme styling
// ============================================================================

interface CortexMenuDropdownProps {
  onClose: () => void;
  activeMenu?: string | null;
  onMenuChange?: (menu: string | null) => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  icon?: string;
}

function CortexMenuDropdown(props: CortexMenuDropdownProps) {
  // Use external activeMenu if provided, otherwise use local state
  const [localActiveMenu, setLocalActiveMenu] = createSignal<string | null>(props.activeMenu || null);
  const activeMenu = () => props.activeMenu !== undefined ? props.activeMenu : localActiveMenu();
  const setActiveMenu = (menu: string | null) => {
    if (props.onMenuChange) {
      props.onMenuChange(menu);
    } else {
      setLocalActiveMenu(menu);
    }
  };
  
  // Menu structure matching VS Code/IDE layout
  const menus: { label: string; items: MenuItem[] }[] = [
    {
      label: "File",
      items: [
        { label: "New File", shortcut: "Ctrl+N", action: () => window.dispatchEvent(new CustomEvent("file:new")) },
        { label: "New Window", shortcut: "Ctrl+Shift+N", action: () => window.dispatchEvent(new CustomEvent("window:new")) },
        { separator: true, label: "" },
        { label: "Open File...", shortcut: "Ctrl+O", action: () => window.dispatchEvent(new CustomEvent("file:open")) },
        { label: "Open Folder...", shortcut: "Ctrl+K Ctrl+O", action: () => window.dispatchEvent(new CustomEvent("folder:open")) },
        { separator: true, label: "" },
        { label: "Save", shortcut: "Ctrl+S", action: () => window.dispatchEvent(new CustomEvent("file:save")) },
        { label: "Save As...", shortcut: "Ctrl+Shift+S", action: () => window.dispatchEvent(new CustomEvent("file:save-as")) },
        { label: "Save All", shortcut: "Ctrl+K S", action: () => window.dispatchEvent(new CustomEvent("file:save-all")) },
        { separator: true, label: "" },
        { label: "Close", shortcut: "Ctrl+W", action: () => window.dispatchEvent(new CustomEvent("file:close")) },
        { label: "Close Folder", action: () => window.dispatchEvent(new CustomEvent("folder:close")) },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", action: () => window.dispatchEvent(new CustomEvent("edit:undo")) },
        { label: "Redo", shortcut: "Ctrl+Shift+Z", action: () => window.dispatchEvent(new CustomEvent("edit:redo")) },
        { separator: true, label: "" },
        { label: "Cut", shortcut: "Ctrl+X", action: () => window.dispatchEvent(new CustomEvent("edit:cut")) },
        { label: "Copy", shortcut: "Ctrl+C", action: () => window.dispatchEvent(new CustomEvent("edit:copy")) },
        { label: "Paste", shortcut: "Ctrl+V", action: () => window.dispatchEvent(new CustomEvent("edit:paste")) },
        { separator: true, label: "" },
        { label: "Find", shortcut: "Ctrl+F", action: () => window.dispatchEvent(new CustomEvent("edit:find")) },
        { label: "Replace", shortcut: "Ctrl+H", action: () => window.dispatchEvent(new CustomEvent("edit:replace")) },
        { label: "Find in Files", shortcut: "Ctrl+Shift+F", action: () => window.dispatchEvent(new CustomEvent("search:find-in-files")) },
      ],
    },
    {
      label: "Selection",
      items: [
        { label: "Select All", shortcut: "Ctrl+A", action: () => window.dispatchEvent(new CustomEvent("selection:select-all")) },
        { label: "Expand Selection", shortcut: "Shift+Alt+→", action: () => window.dispatchEvent(new CustomEvent("selection:expand")) },
        { label: "Shrink Selection", shortcut: "Shift+Alt+←", action: () => window.dispatchEvent(new CustomEvent("selection:shrink")) },
        { separator: true, label: "" },
        { label: "Copy Line Up", shortcut: "Shift+Alt+↑", action: () => window.dispatchEvent(new CustomEvent("selection:copy-line-up")) },
        { label: "Copy Line Down", shortcut: "Shift+Alt+↓", action: () => window.dispatchEvent(new CustomEvent("selection:copy-line-down")) },
        { label: "Move Line Up", shortcut: "Alt+↑", action: () => window.dispatchEvent(new CustomEvent("selection:move-line-up")) },
        { label: "Move Line Down", shortcut: "Alt+↓", action: () => window.dispatchEvent(new CustomEvent("selection:move-line-down")) },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Command Palette...", shortcut: "Ctrl+Shift+P", action: () => window.dispatchEvent(new CustomEvent("command-palette:open")) },
        { label: "Quick Open...", shortcut: "Ctrl+P", action: () => window.dispatchEvent(new CustomEvent("quick-open:show")) },
        { separator: true, label: "" },
        { label: "Explorer", shortcut: "Ctrl+Shift+E", action: () => window.dispatchEvent(new CustomEvent("view:explorer")) },
        { label: "Search", shortcut: "Ctrl+Shift+F", action: () => window.dispatchEvent(new CustomEvent("view:search")) },
        { label: "Source Control", shortcut: "Ctrl+Shift+G", action: () => window.dispatchEvent(new CustomEvent("view:git")) },
        { label: "Extensions", shortcut: "Ctrl+Shift+X", action: () => window.dispatchEvent(new CustomEvent("view:extensions")) },
        { separator: true, label: "" },
        { label: "Terminal", shortcut: "Ctrl+`", action: () => window.dispatchEvent(new CustomEvent("terminal:toggle")) },
        { label: "Toggle Sidebar", shortcut: "Ctrl+B", action: () => window.dispatchEvent(new CustomEvent("sidebar:toggle")) },
      ],
    },
    {
      label: "Go",
      items: [
        { label: "Go to File...", shortcut: "Ctrl+P", action: () => window.dispatchEvent(new CustomEvent("goto:file")) },
        { label: "Go to Symbol...", shortcut: "Ctrl+Shift+O", action: () => window.dispatchEvent(new CustomEvent("goto:symbol")) },
        { label: "Go to Line...", shortcut: "Ctrl+G", action: () => window.dispatchEvent(new CustomEvent("goto:line")) },
        { separator: true, label: "" },
        { label: "Go to Definition", shortcut: "F12", action: () => window.dispatchEvent(new CustomEvent("goto:definition")) },
        { label: "Go to References", shortcut: "Shift+F12", action: () => window.dispatchEvent(new CustomEvent("goto:references")) },
        { separator: true, label: "" },
        { label: "Go Back", shortcut: "Alt+←", action: () => window.dispatchEvent(new CustomEvent("goto:back")) },
        { label: "Go Forward", shortcut: "Alt+→", action: () => window.dispatchEvent(new CustomEvent("goto:forward")) },
      ],
    },
    {
      label: "Terminal",
      items: [
        { label: "New Terminal", shortcut: "Ctrl+Shift+`", action: () => window.dispatchEvent(new CustomEvent("terminal:new")) },
        { label: "Split Terminal", action: () => window.dispatchEvent(new CustomEvent("terminal:split")) },
        { separator: true, label: "" },
        { label: "Run Task...", action: () => window.dispatchEvent(new CustomEvent("task:run")) },
        { label: "Run Build Task", shortcut: "Ctrl+Shift+B", action: () => window.dispatchEvent(new CustomEvent("task:build")) },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Welcome", action: () => window.dispatchEvent(new CustomEvent("help:welcome")) },
        { label: "Documentation", action: () => window.dispatchEvent(new CustomEvent("help:docs")) },
        { label: "Release Notes", action: () => window.dispatchEvent(new CustomEvent("help:release-notes")) },
        { separator: true, label: "" },
        { label: "Keyboard Shortcuts", shortcut: "Ctrl+K Ctrl+S", action: () => window.dispatchEvent(new CustomEvent("help:keybindings")) },
        { separator: true, label: "" },
        { label: "About", action: () => window.dispatchEvent(new CustomEvent("help:about")) },
      ],
    },
  ];

  const handleMenuClick = (label: string) => {
    if (activeMenu() === label) {
      setActiveMenu(null);
    } else {
      setActiveMenu(label);
    }
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.action) {
      item.action();
      props.onClose();
    }
  };

  return (
    <>
      {/* Backdrop to close menu */}
      <div 
        style={{
          position: "fixed",
          top: "0",
          left: "0",
          right: "0",
          bottom: "0",
          "z-index": "2400",
        }}
        onClick={props.onClose}
      />
      
      {/* Menu Container - styled with Figma theme */}
      <div 
        style={{
          position: "fixed",
          top: "53px",
          left: "143px", // Aligned with hamburger menu position
          "z-index": "2500",
          display: "flex",
          "align-items": "flex-start",
          gap: "2px",
          background: "var(--cortex-bg-primary)",
          "border-radius": "var(--cortex-radius-md, 8px)",
          border: "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
          padding: "6px",
          "box-shadow": "0 4px 24px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Menu Bar Items */}
        <For each={menus}>
          {(menu) => (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => handleMenuClick(menu.label)}
                style={{
                  height: "28px",
                  padding: "0 12px",
                  "font-size": "13px",
                  "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
                  "font-weight": "400",
                  color: activeMenu() === menu.label 
                    ? "var(--cortex-accent-primary, var(--cortex-accent-primary))" 
                    : "var(--cortex-text-secondary, var(--cortex-text-secondary))",
                  background: activeMenu() === menu.label 
                    ? "rgba(191, 255, 0, 0.1)" 
                    : "transparent",
                  border: "none",
                  "border-radius": "var(--cortex-radius-sm, 6px)",
                  cursor: "pointer",
                  transition: "all 100ms ease",
                  "white-space": "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (activeMenu() !== menu.label) {
                    (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-primary, var(--cortex-text-primary))";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                  }
                  // If any menu is open, switch to this one on hover
                  if (activeMenu() !== null) {
                    setActiveMenu(menu.label);
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeMenu() !== menu.label) {
                    (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-secondary, var(--cortex-text-secondary))";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                {menu.label}
              </button>
              
              {/* Dropdown Menu */}
              <Show when={activeMenu() === menu.label}>
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: "0",
                    "min-width": "220px",
                    background: "var(--cortex-bg-primary)",
                    "border-radius": "var(--cortex-radius-md, 8px)",
                    border: "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
                    padding: "6px 0",
                    "box-shadow": "0 8px 32px rgba(0,0,0,0.5)",
                    "z-index": "1",
                  }}
                >
                  <For each={menu.items}>
                    {(item) => (
                      <Show
                        when={!item.separator}
                        fallback={
                          <div 
                            style={{ 
                              height: "1px", 
                              background: "var(--cortex-border-default, rgba(255,255,255,0.1))",
                              margin: "6px 0",
                            }} 
                          />
                        }
                      >
                        <button
                          onClick={() => handleItemClick(item)}
                          style={{
                            width: "100%",
                            display: "flex",
                            "align-items": "center",
                            "justify-content": "space-between",
                            height: "28px",
                            padding: "0 12px",
                            "font-size": "13px",
                            "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
                            "font-weight": "400",
                            color: "var(--cortex-text-secondary, var(--cortex-text-secondary))",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            transition: "all 100ms ease",
                            "text-align": "left",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-primary, var(--cortex-text-primary))";
                            (e.currentTarget as HTMLElement).style.background = "rgba(191, 255, 0, 0.1)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.color = "var(--cortex-text-secondary, var(--cortex-text-secondary))";
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                          }}
                        >
                          <span>{item.label}</span>
                          <Show when={item.shortcut}>
                            <span 
                              style={{ 
                                "font-size": "11px",
                                color: "var(--cortex-text-muted, var(--cortex-text-inactive))",
                                "font-family": "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace",
                              }}
                            >
                              {item.shortcut}
                            </span>
                          </Show>
                        </button>
                      </Show>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </>
  );
}

// ============================================================================
// Main Layout Component
// ============================================================================

export function CortexDesktopLayout(props: ParentProps) {
  // Contexts
  const editor = useEditor();
  const sdk = useSDK();
  
  // Layout state
  const initialState = loadLayoutState();
  const [mode, setMode] = createSignal<ViewMode>(initialState.mode);
  const [sidebarTab, setSidebarTab] = createSignal<SidebarTab>(initialState.sidebarTab);
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(initialState.sidebarCollapsed);
  const [sidebarWidth, setSidebarWidth] = createSignal(initialState.sidebarWidth);
  const [chatState, setChatState] = createSignal<ChatPanelState>(initialState.chatState);
  const [isResizing, setIsResizing] = createSignal(false);
  
  // Chat state - connected to SDK
  const [chatInput, setChatInput] = createSignal("");
  
  // Vibe mode state - Agent Factory
  const [selectedConversationId, setSelectedConversationId] = createSignal<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = createSignal<string | null>(null);
  const [terminalOutput, setTerminalOutput] = createSignal<string[]>([
    "$ npm run dev",
    "✓ ready in 245ms",
  ]);
  
  // Sample agents data (will be connected to real agent context)
  const [agents, setAgents] = createSignal<Agent[]>([
    {
      id: "main",
      name: "Main Agent",
      branch: "master",
      status: "idle",
      isExpanded: true,
      conversations: [
        { id: "conv-1", title: "feat: implement navbar", status: "completed", changesCount: 5 },
        { id: "conv-2", title: "fix: tab styling", status: "active", changesCount: 3 },
      ],
    },
  ]);
  
  // Sample file changes (will be connected to git context)
  const [fileChanges, setFileChanges] = createSignal<FileChange[]>([
    { path: "src/App.tsx", additions: 5, deletions: 1, status: "modified" },
    { path: "src/components/Nav.tsx", additions: 53, deletions: 1, status: "added" },
  ]);
  
  // Conversation messages for Vibe mode
  const vibeMessages = createMemo((): Message[] => {
    const messages = sdk.state.messages;
    if (!messages || messages.length === 0) return [];
    
    return messages.map((msg) => {
      const textContent = msg.parts
        .filter((part): part is { type: "text"; content: string } => part.type === "text")
        .map(part => part.content)
        .join("\n");
      
      return {
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: textContent || "",
        timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
      };
    });
  });
  
  // Derive chat messages from SDK state
  const chatMessages = createMemo((): ChatMessage[] => {
    // Use messages from SDK state directly
    const messages = sdk.state.messages;
    if (!messages || messages.length === 0) return [];
    
    return messages.map((msg) => {
      // Extract text content from message parts
      const textContent = msg.parts
        .filter((part): part is { type: "text"; content: string } => part.type === "text")
        .map(part => part.content)
        .join("\n");
      
      return {
        id: msg.id,
        type: msg.role === "user" ? "user" as const : "agent" as const,
        content: textContent || "",
        timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
      };
    });
  });
  
  // Derive processing state from SDK
  const isChatProcessing = () => sdk.state.isStreaming;
  
  // Menu state
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [activeMenuLabel, setActiveMenuLabel] = createSignal<string | null>(null);
  
  // Tauri window
  let appWindow: Awaited<ReturnType<typeof getCurrentWindow>> | null = null;

  // Derived state
  const projectPath = createMemo(() => sdk.state.config.cwd || null);
  const projectName = createMemo(() => {
    const path = projectPath();
    if (!path || path === ".") return "Cortex";
    return path.replace(/\\/g, "/").split("/").pop() || "Cortex";
  });

  // Current file info for status bar
  const activeFile = createMemo(() => 
    editor.state.openFiles.find(f => f.id === editor.state.activeFileId)
  );

  // Save state on changes
  createEffect(() => {
    saveLayoutState({
      mode: mode(),
      sidebarTab: sidebarTab(),
      sidebarCollapsed: sidebarCollapsed(),
      sidebarWidth: sidebarWidth(),
      chatState: chatState(),
    });
  });

  // Window management
  onMount(async () => {
    try {
      appWindow = await getCurrentWindow();
      // Signal backend that UI is ready - shows the window immediately
      invoke("show_window").catch(() => {});
    } catch {
      // Not in Tauri context
    }

    // Listen for mode change events
    const handleModeChange = (e: CustomEvent<{ mode: ViewMode }>) => {
      setMode(e.detail.mode);
    };
    window.addEventListener("viewmode:change", handleModeChange as EventListener);

    // Listen for chat toggle
    const handleChatToggle = () => {
      setChatState(prev => prev === "expanded" ? "minimized" : "expanded");
    };
    window.addEventListener("chat:toggle", handleChatToggle);

    // === Menu Event Handlers ===
    
    // File menu handlers
    const handleFolderOpen = async () => {
      try {
        const selected = await openDialog({ directory: true, multiple: false, title: "Open Folder" });
        if (selected) {
          sdk.updateConfig({ cwd: selected as string });
          setMode("ide");
          setSidebarTab("files");
          setSidebarCollapsed(false);
        }
      } catch (e) {
        console.error("Failed to open folder:", e);
      }
    };
    
    const handleFileOpen = async () => {
      try {
        const selected = await openDialog({ directory: false, multiple: false, title: "Open File" });
        if (selected) {
          editor.openFile(selected as string);
        }
      } catch (e) {
        console.error("Failed to open file:", e);
      }
    };
    
    const handleFileNew = () => {
      editor.createNewFile();
    };
    
    const handleFileSave = () => {
      const activeId = editor.state.activeFileId;
      if (activeId) {
        editor.saveFile(activeId);
      }
    };
    
    const handleFileSaveAll = () => {
      editor.state.openFiles.forEach(file => {
        if (file.modified) {
          editor.saveFile(file.id);
        }
      });
    };
    
    const handleFileClose = () => {
      const activeId = editor.state.activeFileId;
      if (activeId) {
        editor.closeFile(activeId);
      }
    };
    
    const handleFolderClose = () => {
      sdk.updateConfig({ cwd: "." });
    };
    
    const handleWindowNew = async () => {
      console.log("[CortexDesktopLayout] handleWindowNew called");
      try {
        await invoke("create_new_window", {});
      } catch (e) {
        console.error("Failed to create new window:", e);
      }
    };
    
    // View menu handlers
    const handleViewExplorer = () => { setSidebarTab("files"); setSidebarCollapsed(false); };
    const handleViewSearch = () => { setSidebarTab("search"); setSidebarCollapsed(false); };
    const handleViewGit = () => { setSidebarTab("git"); setSidebarCollapsed(false); };
    const handleViewExtensions = () => { setSidebarTab("extensions"); setSidebarCollapsed(false); };
    const handleSidebarToggle = () => { setSidebarCollapsed(!sidebarCollapsed()); };
    
    // Edit menu handlers
    const handleUndo = () => document.execCommand("undo");
    const handleRedo = () => document.execCommand("redo");
    const handleCut = () => document.execCommand("cut");
    const handleCopy = () => document.execCommand("copy");
    const handlePaste = () => document.execCommand("paste");
    const handleSelectAll = () => document.execCommand("selectAll");
    
    // Help menu handlers
    const handleHelpDocs = () => {
      window.open("https://docs.cortex.dev", "_blank");
    };
    
    // Register all event listeners
    window.addEventListener("folder:open", handleFolderOpen);
    window.addEventListener("file:open", handleFileOpen);
    window.addEventListener("file:new", handleFileNew);
    window.addEventListener("file:save", handleFileSave);
    window.addEventListener("file:save-all", handleFileSaveAll);
    window.addEventListener("file:close", handleFileClose);
    window.addEventListener("folder:close", handleFolderClose);
    window.addEventListener("window:new", handleWindowNew);
    window.addEventListener("view:explorer", handleViewExplorer);
    window.addEventListener("view:search", handleViewSearch);
    window.addEventListener("view:git", handleViewGit);
    window.addEventListener("view:extensions", handleViewExtensions);
    window.addEventListener("sidebar:toggle", handleSidebarToggle);
    window.addEventListener("edit:undo", handleUndo);
    window.addEventListener("edit:redo", handleRedo);
    window.addEventListener("edit:cut", handleCut);
    window.addEventListener("edit:copy", handleCopy);
    window.addEventListener("edit:paste", handlePaste);
    window.addEventListener("selection:select-all", handleSelectAll);
    window.addEventListener("help:docs", handleHelpDocs);

    onCleanup(() => {
      window.removeEventListener("viewmode:change", handleModeChange as EventListener);
      window.removeEventListener("chat:toggle", handleChatToggle);
      window.removeEventListener("folder:open", handleFolderOpen);
      window.removeEventListener("file:open", handleFileOpen);
      window.removeEventListener("file:new", handleFileNew);
      window.removeEventListener("file:save", handleFileSave);
      window.removeEventListener("file:save-all", handleFileSaveAll);
      window.removeEventListener("file:close", handleFileClose);
      window.removeEventListener("folder:close", handleFolderClose);
      window.removeEventListener("window:new", handleWindowNew);
      window.removeEventListener("view:explorer", handleViewExplorer);
      window.removeEventListener("view:search", handleViewSearch);
      window.removeEventListener("view:git", handleViewGit);
      window.removeEventListener("view:extensions", handleViewExtensions);
      window.removeEventListener("sidebar:toggle", handleSidebarToggle);
      window.removeEventListener("edit:undo", handleUndo);
      window.removeEventListener("edit:redo", handleRedo);
      window.removeEventListener("edit:cut", handleCut);
      window.removeEventListener("edit:copy", handleCopy);
      window.removeEventListener("edit:paste", handlePaste);
      window.removeEventListener("selection:select-all", handleSelectAll);
      window.removeEventListener("help:docs", handleHelpDocs);
    });
  });

  // Window control handlers
  const handleMinimize = async () => {
    if (appWindow) await appWindow.minimize();
  };

  const handleMaximize = async () => {
    if (appWindow) {
      const isMax = await appWindow.isMaximized();
      if (isMax) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    }
  };

  const handleClose = async () => {
    if (appWindow) await appWindow.close();
  };

  // Mode change handler - carousel handles animation automatically
  const handleModeChange = (newMode: ViewMode) => {
    if (mode() === newMode) return;
    setMode(newMode);
    if (newMode === "vibe") {
      setChatState("home");
    } else {
      setChatState("minimized");
    }
  };

  // Navigation handlers (ActivityBar is only visible in IDE mode)
  const handleNavItemClick = (id: string) => {
    // Handle special actions
    if (id === "home") {
      // Switch to Vibe mode
      setMode("vibe");
      setChatState("home");
      return;
    }
    
    if (id === "new") {
      // Dispatch new file event
      window.dispatchEvent(new CustomEvent("file:new"));
      return;
    }

    const tabId = id as SidebarTab;
    
    if (tabId === "factory") {
      // Factory is full-screen mode
      setSidebarTab("factory");
      setSidebarCollapsed(false);
      return;
    }

    // For sidebar tabs (files, git, debug, extensions, agents, etc.)
    if (sidebarCollapsed()) {
      setSidebarCollapsed(false);
      setSidebarTab(tabId);
    } else if (sidebarTab() === tabId) {
      setSidebarCollapsed(true);
    } else {
      setSidebarTab(tabId);
    }
  };

  // File selection handler
  const handleFileSelect = (filePath: string) => {
    editor.openFile(filePath);
  };

  // Chat handlers
  const handleChatSubmit = async (value: string) => {
    if (!value.trim()) return;
    
    // Send message via SDK
    try {
      await sdk.sendMessage(value);
      setChatInput("");
      
      // Switch to expanded state to show messages
      if (mode() === "vibe") {
        // Stay in vibe mode but messages will show
      } else {
        setChatState("expanded");
      }
    } catch (e) {
      console.error("[CortexDesktopLayout] Failed to send message:", e);
    }
  };

  // Styles
  const rootStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    width: "100vw",
    height: "100vh",
    background: "var(--cortex-bg-primary)",
    overflow: "hidden",
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    color: "var(--cortex-text-primary, var(--cortex-text-primary))",
  });

  const mainStyle = (): JSX.CSSProperties => ({
    display: "flex",
    flex: "1",
    overflow: "hidden",
    position: "relative",
  });

  // Carousel container - clips overflow to show only one page
  const carouselContainerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    overflow: "hidden",
    position: "relative",
  });

  // Carousel slider - holds both pages side by side
  const carouselSliderStyle = (): JSX.CSSProperties => ({
    display: "flex",
    width: "200%",
    height: "100%",
    transform: mode() === "ide" ? "translateX(-50%)" : "translateX(0)",
    transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
  });

  // Each page = 50% of slider = 100% of visible container
  const carouselPageStyle = (): JSX.CSSProperties => ({
    width: "50%",
    height: "100%",
    display: "flex",
    "flex-shrink": "0",
  });

  // Sidebar as "card" style per Figma design (Rectangle 23503)
  // Figma: x:60, y:69, 317×882px
  // Gap calculation: x:60 - (ActivityBar x:8 + width:40) = 12px gap
  const sidebarStyle = (): JSX.CSSProperties => ({
    width: sidebarCollapsed() ? "0" : `${sidebarWidth()}px`,
    height: "calc(100% - 16px)", // Full height minus top/bottom margins
    "margin-top": "8px",
    "margin-bottom": "8px",
    "margin-left": "12px", // 12px gap from ActivityBar
    "flex-shrink": "0",
    overflow: "hidden",
    transition: isResizing() ? "none" : "width 150ms ease, opacity 150ms ease",
    background: "var(--cortex-bg-primary)",
    "border-radius": "var(--cortex-radius-lg)",
    border: "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
    opacity: sidebarCollapsed() ? "0" : "1",
    display: "flex",
    "flex-direction": "column",
  });

  // Editor/Content as "card" style per Figma design (Rectangle 23504)
  // Figma: x:389, y:69, 1146×882px
  // Gap calculation: x:389 - (Sidebar x:60 + width:317) = 12px gap
  const editorContainerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    "min-width": "0",
    height: "calc(100% - 16px)",
    "margin-top": "8px",
    "margin-bottom": "8px",
    "margin-left": "12px", // 12px gap from sidebar
    "margin-right": "8px", // 8px from right edge
    background: "var(--cortex-bg-primary)",
    "border-radius": "var(--cortex-radius-lg)",
    border: "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
  });

  return (
    <div style={rootStyle()}>
      {/* Title Bar - 53px height (Figma exact) */}
      <CortexTitleBar
        appName={projectName()}
        currentPage={activeFile()?.name || "Home"}
        isDraft={activeFile()?.modified}
        mode={mode()}
        onModeChange={handleModeChange}
        isDarkMode={true}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onClose={handleClose}
        isMenuOpen={isMenuOpen()}
        onMenuToggle={() => setIsMenuOpen(!isMenuOpen())}
        activeMenu={activeMenuLabel()}
        onMenuSelect={setActiveMenuLabel}
      />

      {/* Main Content Area - Carousel for Vibe/IDE */}
      <main style={mainStyle()}>
        {/* Carousel Container */}
        <div style={carouselContainerStyle()}>
          {/* Carousel Slider - slides between Vibe and IDE */}
          <div style={carouselSliderStyle()}>
            
            {/* Page 1: Vibe Mode - 3 Column Layout (Conductor style) */}
            <div style={{ ...carouselPageStyle(), display: "flex", background: "var(--cortex-bg-primary)" }}>
              {/* Left: Agent Sidebar */}
              <CortexAgentSidebar
                projectName={projectName()}
                agents={agents()}
                selectedConversationId={selectedConversationId()}
                onConversationSelect={(agentId, convId) => {
                  setSelectedAgentId(agentId);
                  setSelectedConversationId(convId);
                }}
                onAgentToggle={(agentId) => {
                  setAgents(prev => prev.map(a => 
                    a.id === agentId ? { ...a, isExpanded: !a.isExpanded } : a
                  ));
                }}
                onNewWorkspace={() => {
                  // TODO: Create new agent workspace
                }}
              />
              
              {/* Center: Conversation View */}
              <CortexConversationView
                conversationTitle={
                  agents().flatMap(a => a.conversations).find(c => c.id === selectedConversationId())?.title || "New Conversation"
                }
                branchName={agents().find(a => a.id === selectedAgentId)?.branch}
                status="in_progress"
                messages={vibeMessages()}
                inputValue={chatInput()}
                onInputChange={setChatInput}
                onSubmit={handleChatSubmit}
                isProcessing={isChatProcessing()}
                modelName="Claude 3.5 Sonnet"
              />
              
              {/* Right: Changes Panel with Terminal */}
              <CortexChangesPanel
                changes={fileChanges()}
                terminalOutput={terminalOutput()}
                branchName={projectName()}
                onFileClick={(path) => {
                  handleFileSelect(path);
                }}
                onRunCommand={(cmd) => {
                  setTerminalOutput(prev => [...prev, `$ ${cmd}`, "Running..."]);
                }}
                onRun={() => {
                  setTerminalOutput(prev => [...prev, "$ npm run dev", "Starting..."]);
                }}
              />
            </div>

            {/* Page 2: IDE Mode */}
            <div style={{ ...carouselPageStyle(), display: "flex", background: "var(--cortex-bg-primary)" }}>
              {/* Activity Bar - 40px width */}
              <CortexActivityBar
                activeId={sidebarCollapsed() ? null : sidebarTab()}
                onItemClick={handleNavItemClick}
              />

              {/* IDE Content Area */}
              <div style={{ display: "flex", flex: "1", overflow: "hidden" }}>
                {/* Sidebar */}
                <Show when={!sidebarCollapsed()}>
                  <aside style={sidebarStyle()}>
                    <Show when={sidebarTab() === "files"}>
                      <Show 
                        when={projectPath() && projectPath() !== "."} 
                        fallback={<EmptyExplorer onOpenFolder={() => window.dispatchEvent(new CustomEvent("folder:open"))} />}
                      >
                        <Suspense fallback={<SidebarSkeleton />}>
                          <RealFileExplorer
                            rootPath={projectPath()}
                            onFileSelect={handleFileSelect}
                          />
                        </Suspense>
                      </Show>
                    </Show>
                    
                    <Show when={sidebarTab() === "search"}>
                      <CortexSearchPanel />
                    </Show>
                    
                    <Show when={sidebarTab() === "git"}>
                      <CortexGitPanel />
                    </Show>
                    
                    <Show when={sidebarTab() === "debug"}>
                      <CortexDebugPanel />
                    </Show>
                    
                    <Show when={sidebarTab() === "extensions"}>
                      <CortexExtensionsPanel />
                    </Show>
                    
                    <Show when={sidebarTab() === "agents"}>
                      <Suspense fallback={<SidebarSkeleton />}>
                        <AgentPanel />
                      </Suspense>
                    </Show>
                    
                    <Show when={sidebarTab() === "factory"}>
                      <Suspense fallback={<SidebarSkeleton />}>
                        <AgentFactory />
                      </Suspense>
                    </Show>
                  </aside>

                  {/* Resize Handle */}
                  <div
                    style={{
                      width: "4px",
                      cursor: "col-resize",
                      background: "transparent",
                      transition: "background 150ms",
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsResizing(true);
                      const startX = e.clientX;
                      const startWidth = sidebarWidth();
                      
                      const onMouseMove = (e: MouseEvent) => {
                        const delta = startX - e.clientX;
                        setSidebarWidth(Math.max(200, Math.min(600, startWidth - delta)));
                      };
                      
                      const onMouseUp = () => {
                        setIsResizing(false);
                        document.removeEventListener("mousemove", onMouseMove);
                        document.removeEventListener("mouseup", onMouseUp);
                      };
                      
                      document.addEventListener("mousemove", onMouseMove);
                      document.addEventListener("mouseup", onMouseUp);
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--cortex-accent-primary, var(--cortex-accent-primary))";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  />
                </Show>

                {/* Editor */}
                <div style={editorContainerStyle()}>
                  <Suspense fallback={
                    <div style={{
                      flex: "1",
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "center",
                      background: "var(--cortex-bg-primary)",
                    }}>
                      <div style={{
                        width: "32px",
                        height: "32px",
                        border: "2px solid var(--cortex-text-muted)",
                        "border-top-color": "var(--cortex-accent-primary, var(--cortex-accent-primary))",
                        "border-radius": "var(--cortex-radius-full)",
                        animation: "spin 0.8s linear infinite",
                      }} />
                    </div>
                  }>
                    <EditorPanel />
                  </Suspense>
                </div>
              </div>

              {/* Chat Panel Overlay in IDE mode - only show when expanded */}
              <Show when={chatState() === "expanded"}>
                <CortexChatPanel
                  state={chatState()}
                  messages={chatMessages()}
                  inputValue={chatInput()}
                  onInputChange={setChatInput}
                  onSubmit={handleChatSubmit}
                  isProcessing={isChatProcessing()}
                  modelName="Claude 3.5 Sonnet"
                  style={{
                    position: "absolute",
                    right: "16px",
                    bottom: "44px",
                    "z-index": "100",
                  }}
                />
              </Show>
            </div>
          </div>
        </div>
      </main>

      {/* Route children (dialogs, modals, pages) - only rendered in IDE mode, or always for dialogs */}
      <Show when={mode() === "ide"}>
        {props.children}
      </Show>
    </div>
  );
}

export default CortexDesktopLayout;



