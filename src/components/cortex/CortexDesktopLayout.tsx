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
import { useAIAgent } from "@/context/ai/AIAgentContext";
import { useMultiRepo } from "@/context/MultiRepoContext";

// Lazy load heavy panels
const AgentPanel = lazy(() => import("@/components/ai/AgentPanel").then(m => ({ default: m.AgentPanel })));
const AgentFactory = lazy(() => import("@/components/factory/AgentFactory").then(m => ({ default: m.AgentFactory })));

// Monaco editor wrapper
const EditorPanel = lazy(() => import("@/components/editor/EditorPanel").then(m => ({ default: m.EditorPanel })));

// Real file explorer
const RealFileExplorer = lazy(() => import("@/components/FileExplorer").then(m => ({ default: m.FileExplorer })));

// Lazy load sidebar panels
const CortexGitPanel = lazy(() => import("./CortexGitPanel").then(m => ({ default: m.CortexGitPanel })));
const CortexSearchPanel = lazy(() => import("./CortexSearchPanel").then(m => ({ default: m.CortexSearchPanel })));
const CortexDebugPanel = lazy(() => import("./CortexDebugPanel").then(m => ({ default: m.CortexDebugPanel })));
const CortexExtensionsPanel = lazy(() => import("./CortexExtensionsPanel").then(m => ({ default: m.CortexExtensionsPanel })));

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
// Main Layout Component
// ============================================================================

export function CortexDesktopLayout(props: ParentProps) {
  // Contexts
  const editor = useEditor();
  const sdk = useSDK();
  
  // Optional contexts - may not be available in all provider configurations
  let aiAgent: ReturnType<typeof useAIAgent> | null = null;
  try {
    aiAgent = useAIAgent();
  } catch {
    // AIAgentContext not available
  }
  
  let multiRepo: ReturnType<typeof useMultiRepo> | null = null;
  try {
    multiRepo = useMultiRepo();
  } catch {
    // MultiRepoContext not available
  }
  
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
  const [terminalOutput, setTerminalOutput] = createSignal<string[]>([]);
  
  // Agents from AIAgentContext - reactive memo
  const [localAgents, setLocalAgents] = createSignal<Agent[]>([]);
  
  // Derive agents from AIAgentContext when available
  const agents = createMemo((): Agent[] => {
    if (aiAgent) {
      const contextAgents = aiAgent.agents();
      if (contextAgents.length > 0) {
        return contextAgents.map(a => ({
          id: a.id,
          name: a.name,
          branch: "main",
          status: a.status === "failed" ? "error" : a.status as Agent["status"],
          isExpanded: true,
          conversations: [],
        }));
      }
    }
    return localAgents();
  });
  
  // Alias for setAgents to allow local agent creation when context unavailable
  const setAgents = setLocalAgents;
  
  // File changes from MultiRepoContext - reactive memo
  const fileChanges = createMemo((): FileChange[] => {
    if (multiRepo) {
      const repo = multiRepo.activeRepository();
      if (repo) {
        const allFiles = [...repo.stagedFiles, ...repo.unstagedFiles];
        return allFiles.map(f => ({
          path: f.path,
          additions: 0,
          deletions: 0,
          status: f.status === "added" ? "added" : f.status === "deleted" ? "deleted" : "modified",
        }));
      }
    }
    return [];
  });
  
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
      // Create a new untitled file using openVirtualFile
      editor.openVirtualFile("Untitled", "", "plaintext");
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
      if (import.meta.env.DEV) console.log("[CortexDesktopLayout] handleWindowNew called");
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
                selectedConversationId={selectedConversationId() ?? undefined}
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
                  // Create a new agent workspace with a unique ID and default settings
                  const newAgentId = `agent-${Date.now()}`;
                  const agentNumber = agents().length + 1;
                  setAgents(prev => [...prev, {
                    id: newAgentId,
                    name: `Agent ${agentNumber}`,
                    branch: "main",
                    status: "idle",
                    isExpanded: true,
                    conversations: [],
                  }]);
                  // Automatically select the new agent
                  setSelectedAgentId(newAgentId);
                  setSelectedConversationId(null);
                  // Notify user of successful workspace creation
                  window.dispatchEvent(new CustomEvent("notification", {
                    detail: {
                      type: "success",
                      message: `New agent workspace "Agent ${agentNumber}" created.`,
                    },
                  }));
                }}
              />
              
              {/* Center: Conversation View */}
              <CortexConversationView
                conversationTitle={
                  agents().flatMap(a => a.conversations).find(c => c.id === selectedConversationId())?.title || "New Conversation"
                }
                branchName={agents().find(a => a.id === selectedAgentId())?.branch}
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
                      <Suspense fallback={<SidebarSkeleton />}>
                        <CortexSearchPanel />
                      </Suspense>
                    </Show>
                    
                    <Show when={sidebarTab() === "git"}>
                      <Suspense fallback={<SidebarSkeleton />}>
                        <CortexGitPanel />
                      </Suspense>
                    </Show>
                    
                    <Show when={sidebarTab() === "debug"}>
                      <Suspense fallback={<SidebarSkeleton />}>
                        <CortexDebugPanel />
                      </Suspense>
                    </Show>
                    
                    <Show when={sidebarTab() === "extensions"}>
                      <Suspense fallback={<SidebarSkeleton />}>
                        <CortexExtensionsPanel />
                      </Suspense>
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



