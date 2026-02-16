import { createContext, useContext, ParentProps, createMemo, batch, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { fsWriteFile } from "../utils/tauri-api";
import type { GridCell, EditorGridState } from "../components/editor/EditorGrid";
import {
  saveGridState,
  loadGridState,
  createSingleEditorLayout,
  splitCell,
  closeCell as closeGridCell,
} from "../utils/gridSerializer";

// Re-export types from split contexts for backwards compatibility
export type { CursorPosition, Selection, OpenFile } from "./editor/EditorFilesContext";
export type { SplitDirection, EditorGroup, EditorSplit, EditorLayout } from "./editor/EditorUIContext";
export type { GridCell, EditorGridState };

// Import the split context types for internal use
import type { OpenFile } from "./editor/EditorFilesContext";
import type { SplitDirection, EditorGroup, EditorSplit } from "./editor/EditorUIContext";

// ============================================================================
// Legacy State Interface (maintained for backwards compatibility)
// ============================================================================

interface EditorState {
  openFiles: OpenFile[];
  activeFileId: string | null;
  activeGroupId: string;
  groups: EditorGroup[];
  splits: EditorSplit[];
  cursorCount: number;
  selectionCount: number;
  isOpening: boolean;
  pinnedTabs: string[]; // IDs of pinned tabs
  previewTab: string | null; // ID of the preview tab (italic title, replaced on next preview)
  // Grid layout state (new serializable grid system)
  gridState: EditorGridState | null;
  useGridLayout: boolean; // Flag to switch between legacy and grid layout
}

interface EditorContextValue {
  state: EditorState;
  openFile: (path: string, groupId?: string) => Promise<void>;
  openVirtualFile: (name: string, content: string, language?: string) => Promise<void>;
  closeFile: (fileId: string) => void;
  setActiveFile: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  saveFile: (fileId: string) => Promise<void>;
  closeAllFiles: (includePinned?: boolean) => void;
  splitEditor: (direction: SplitDirection) => void;
  closeGroup: (groupId: string) => void;
  setActiveGroup: (groupId: string) => void;
  moveFileToGroup: (fileId: string, targetGroupId: string) => void;
  updateCursorInfo: (cursorCount: number, selectionCount: number) => void;
  getActiveGroup: () => EditorGroup | undefined;
  getGroupFiles: (groupId: string) => OpenFile[];
  unsplit: () => void;
  reorderTabs: (sourceFileId: string, targetFileId: string, groupId?: string) => void;
  updateSplitRatio: (splitId: string, ratio: number) => void;
  
  // Pinned tabs
  pinTab: (tabId: string) => void;
  unpinTab: (tabId: string) => void;
  togglePinTab: (tabId: string) => void;
  isTabPinned: (tabId: string) => boolean;
  
  // Preview tabs (VS Code-style preview mode)
  openPreview: (path: string, groupId?: string) => Promise<void>;
  promotePreviewToPermanent: (fileId?: string) => void;
  isPreviewTab: (tabId: string) => boolean;
  
  // Grid layout operations
  gridState: EditorGridState | null;
  useGridLayout: boolean;
  setUseGridLayout: (use: boolean) => void;
  splitEditorInGrid: (direction: "horizontal" | "vertical", fileId?: string) => void;
  closeGridCell: (cellId: string) => void;
  moveEditorToGridCell: (fileId: string, cellId: string) => void;
  updateGridState: (state: EditorGridState) => void;
  
  // New granular selectors for performance (components can use these instead of full state)
  selectors: {
    openFileCount: () => number;
    activeFile: () => OpenFile | undefined;
    hasModifiedFiles: () => boolean;
    modifiedFileIds: () => string[];
    isSplit: () => boolean;
    groupCount: () => number;
    pinnedTabIds: () => string[];
    previewTabId: () => string | null;
    gridState: () => EditorGridState | null;
    useGridLayout: () => boolean;
  };
}

const EditorContext = createContext<EditorContextValue>();

// ============================================================================
// Utilities
// ============================================================================

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const name = filename.toLowerCase();
  
  if (name === "dockerfile" || name.startsWith("dockerfile.")) return "dockerfile";
  if (name === "makefile" || name === "gnumakefile") return "shell";
  if (name === ".gitignore" || name === ".dockerignore") return "shell";
  if (name === ".env" || name.startsWith(".env.")) return "shell";
  
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    mts: "typescript",
    cts: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    html: "html",
    htm: "html",
    xml: "html",
    svg: "html",
    css: "css",
    scss: "css",
    sass: "css",
    less: "css",
    json: "json",
    jsonc: "json",
    json5: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    ini: "toml",
    cfg: "toml",
    conf: "toml",
    py: "python",
    pyw: "python",
    pyi: "python",
    rs: "rust",
    go: "go",
    rb: "python",
    php: "javascript",
    java: "typescript",
    kt: "typescript",
    kts: "typescript",
    scala: "typescript",
    swift: "typescript",
    c: "rust",
    h: "rust",
    cpp: "rust",
    cc: "rust",
    cxx: "rust",
    hpp: "rust",
    cs: "typescript",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    ps1: "shell",
    psm1: "shell",
    bat: "shell",
    cmd: "shell",
    sql: "sql",
    mysql: "sql",
    pgsql: "sql",
    sqlite: "sql",
    md: "markdown",
    mdx: "markdown",
    markdown: "markdown",
    rst: "markdown",
    txt: "plaintext",
    lock: "json",
    editorconfig: "toml",
    gitattributes: "shell",
  };
  
  return langMap[ext] || "plaintext";
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function EditorProvider(props: ParentProps) {
  const defaultGroupId = "group-default";
  
  // Load pinned tabs from localStorage
  const loadPinnedTabs = (): string[] => {
    try {
      const stored = localStorage.getItem("cortex_pinned_tabs");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("[EditorContext] Failed to load pinned tabs:", e);
    }
    return [];
  };

  // Load grid layout preference from localStorage
  const loadUseGridLayout = (): boolean => {
    try {
      const stored = localStorage.getItem("orion_use_grid_layout");
      return stored === "true";
    } catch (e) {
      return false;
    }
  };

  // Load initial grid state
  const initialGridState = loadGridState();

  const [state, setState] = createStore<EditorState>({
    openFiles: [],
    activeFileId: null,
    activeGroupId: defaultGroupId,
    groups: [
      {
        id: defaultGroupId,
        fileIds: [],
        activeFileId: null,
        splitRatio: 1,
      },
    ],
    splits: [],
    cursorCount: 1,
    selectionCount: 0,
    isOpening: false,
    pinnedTabs: loadPinnedTabs(),
    previewTab: null,
    gridState: initialGridState,
    useGridLayout: loadUseGridLayout(),
  });

  // ============================================================================
  // Granular Selectors (using createMemo for selective subscriptions)
  // Components can use these instead of subscribing to full state for better perf
  // ============================================================================
  
  const selectors = {
    openFileCount: createMemo(() => state.openFiles.length),
    activeFile: createMemo(() => state.openFiles.find((f) => f.id === state.activeFileId)),
    hasModifiedFiles: createMemo(() => state.openFiles.some((f) => f.modified)),
    modifiedFileIds: createMemo(() => state.openFiles.filter((f) => f.modified).map((f) => f.id)),
    isSplit: createMemo(() => state.groups.length > 1),
    groupCount: createMemo(() => state.groups.length),
    pinnedTabIds: createMemo(() => state.pinnedTabs),
    previewTabId: createMemo(() => state.previewTab),
    gridState: createMemo(() => state.gridState),
    useGridLayout: createMemo(() => state.useGridLayout),
  };

  // ============================================================================
  // File Operations
  // ============================================================================

  const openFile = async (path: string, groupId?: string) => {
    const perfStart = performance.now();
    const targetGroupId = groupId || state.activeGroupId;
    
    const existing = state.openFiles.find((f) => f.path === path);
    if (existing) {
      // Batch all related state updates together
      batch(() => {
        setState("activeFileId", existing.id);
        setState("activeGroupId", targetGroupId);
        setState(
          "groups",
          (g) => g.id === targetGroupId,
          produce((group) => {
            if (!group.fileIds.includes(existing.id)) {
              group.fileIds.push(existing.id);
            }
            group.activeFileId = existing.id;
          })
        );
      });
      console.debug(`[EditorContext] openFile (existing): ${(performance.now() - perfStart).toFixed(1)}ms`);
      return;
    }

    setState("isOpening", true);
    try {
      const readStart = performance.now();
      const content = await invoke<string>("fs_read_file", { path });
      console.debug(`[EditorContext] fs_read_file: ${(performance.now() - readStart).toFixed(1)}ms (${(content.length / 1024).toFixed(1)}KB)`);
      
      // Extract filename from path (handles both / and \ separators)
      const name = path.split(/[/\\]/).pop() || path;
      const id = `file-${generateId()}`;

      const newFile: OpenFile = {
        id,
        path,
        name,
        content,
        language: detectLanguage(name),
        modified: false,
        cursors: [{ line: 1, column: 1 }],
        selections: [],
      };

      // Batch all state updates for opening a new file
      const batchStart = performance.now();
      batch(() => {
        setState("openFiles", (files) => [...files, newFile]);
        setState("activeFileId", id);
        setState("activeGroupId", targetGroupId);
        setState(
          "groups",
          (g) => g.id === targetGroupId,
          produce((group) => {
            group.fileIds.push(id);
            group.activeFileId = id;
          })
        );
      });
      console.debug(`[EditorContext] batch setState: ${(performance.now() - batchStart).toFixed(1)}ms`);
      console.debug(`[EditorContext] openFile (new) TOTAL: ${(performance.now() - perfStart).toFixed(1)}ms`);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Failed to open file:", errorMessage);
      
      // Show error notification to user
      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: {
            type: "error",
            title: "Failed to open file",
            message: `Could not open "${path.split("/").pop() || path.split("\\").pop() || path}": ${errorMessage}`,
          },
        })
      );
    } finally {
      setState("isOpening", false);
    }
  };

  const openVirtualFile = async (name: string, content: string, language?: string) => {
    const targetGroupId = state.activeGroupId;
    const id = `virtual-${generateId()}`;
    const path = `virtual:///${name}`;

    const newFile: OpenFile = {
      id,
      path,
      name,
      content,
      language: language || detectLanguage(name),
      modified: false,
      cursors: [{ line: 1, column: 1 }],
      selections: [],
    };

    batch(() => {
      setState("openFiles", (files) => [...files, newFile]);
      setState("activeFileId", id);
      setState("activeGroupId", targetGroupId);
      setState(
        "groups",
        (g) => g.id === targetGroupId,
        produce((group) => {
          group.fileIds.push(id);
          group.activeFileId = id;
        })
      );
    });
  };

  const closeFile = (fileId: string) => {
    const fileIndex = state.openFiles.findIndex((f) => f.id === fileId);
    if (fileIndex === -1) return;

    // Calculate next active file BEFORE removing anything
    const activeGroup = state.groups.find((g) => g.id === state.activeGroupId);
    const fileIdIndexInGroup = activeGroup?.fileIds.indexOf(fileId) ?? -1;
    const remainingFileIds = activeGroup?.fileIds.filter((id) => id !== fileId) || [];
    const nextActiveFileId = state.activeFileId === fileId 
      ? (remainingFileIds[Math.max(0, fileIdIndexInGroup - 1)] || null)
      : state.activeFileId;

    // Dispatch event to let Monaco dispose before DOM cleanup
    window.dispatchEvent(new CustomEvent("editor:file-closing", { 
      detail: { fileId } 
    }));

    // Use setTimeout with 16ms (one frame) to ensure Monaco has time to process
    // the file-closing event and dispose before SolidJS cleans up the DOM
    setTimeout(() => {
      // Batch all state updates for closing a file
      batch(() => {
        // First update active file to prevent Show component from trying to access removed file
        if (state.activeFileId === fileId) {
          setState("activeFileId", nextActiveFileId);
        }

        // Then update groups
        setState("groups", (groups) =>
          groups.map((group) => {
            const groupFileIdIndex = group.fileIds.indexOf(fileId);
            if (groupFileIdIndex === -1) return group;
            
            const newFileIds = group.fileIds.filter((id) => id !== fileId);
            let newActiveFileId = group.activeFileId;
            
            if (group.activeFileId === fileId) {
              newActiveFileId = newFileIds[Math.max(0, groupFileIdIndex - 1)] || null;
            }
            
            return {
              ...group,
              fileIds: newFileIds,
              activeFileId: newActiveFileId,
            };
          })
        );

        // Finally remove the file from openFiles
        setState("openFiles", (files) => files.filter((f) => f.id !== fileId));
      });
    }, 16);
  };

  const setActiveFile = (fileId: string) => {
    const containingGroup = state.groups.find((g) => g.fileIds.includes(fileId));
    
    // Batch all state updates for setting active file
    batch(() => {
      setState("activeFileId", fileId);
      if (containingGroup) {
        setState("activeGroupId", containingGroup.id);
        setState(
          "groups",
          (g) => g.id === containingGroup.id,
          "activeFileId",
          fileId
        );
      }
    });
  };

  const updateFileContent = (fileId: string, content: string) => {
    // Batch content and modified flag updates
    batch(() => {
      setState(
        "openFiles",
        (f) => f.id === fileId,
        "content",
        content
      );
      setState(
        "openFiles",
        (f) => f.id === fileId,
        "modified",
        true
      );
      
      // If this is the preview tab and content is being edited, promote to permanent
      if (state.previewTab === fileId) {
        setState("previewTab", null);
      }
    });
  };

  const saveFile = async (fileId: string) => {
    const file = state.openFiles.find((f) => f.id === fileId);
    if (!file) return;

    try {
      await fsWriteFile(file.path, file.content);

      setState(
        "openFiles",
        (f) => f.id === fileId,
        "modified",
        false
      );
      
      // Emit file saved event for run on save tasks
      window.dispatchEvent(
        new CustomEvent("cortex:file_saved", {
          detail: { path: file.path, fileId: file.id },
        })
      );
    } catch (e) {
      console.error("Failed to save file:", e);
    }
  };

  const closeAllFiles = (includePinned: boolean = false) => {
    // Batch all state updates for closing all files
    batch(() => {
      if (includePinned) {
        // Close all files including pinned
        setState("openFiles", []);
        setState("activeFileId", null);
        setState("pinnedTabs", []);
        savePinnedTabs([]);
        setState("groups", (groups) =>
          groups.map((group) => ({
            ...group,
            fileIds: [],
            activeFileId: null,
          }))
        );
      } else {
        // Close only unpinned files
        const pinnedSet = new Set(state.pinnedTabs);
        const remainingFiles = state.openFiles.filter((f) => pinnedSet.has(f.id));
        const remainingFileIds = remainingFiles.map((f) => f.id);
        
        setState("openFiles", remainingFiles);
        
        // Update active file if current one is being closed
        if (state.activeFileId && !pinnedSet.has(state.activeFileId)) {
          setState("activeFileId", remainingFileIds[0] || null);
        }
        
        setState("groups", (groups) =>
          groups.map((group) => {
            const newFileIds = group.fileIds.filter((id) => pinnedSet.has(id));
            const newActiveFileId = group.activeFileId && pinnedSet.has(group.activeFileId)
              ? group.activeFileId
              : newFileIds[0] || null;
            return {
              ...group,
              fileIds: newFileIds,
              activeFileId: newActiveFileId,
            };
          })
        );
      }
    });
  };

  // ============================================================================
  // Pinned Tabs
  // ============================================================================

  const savePinnedTabs = (pinnedTabs: string[]) => {
    try {
      localStorage.setItem("cortex_pinned_tabs", JSON.stringify(pinnedTabs));
    } catch (e) {
      console.error("[EditorContext] Failed to save pinned tabs:", e);
    }
  };

  const pinTab = (tabId: string) => {
    if (state.pinnedTabs.includes(tabId)) return;
    
    const newPinnedTabs = [...state.pinnedTabs, tabId];
    setState("pinnedTabs", newPinnedTabs);
    savePinnedTabs(newPinnedTabs);
  };

  const unpinTab = (tabId: string) => {
    if (!state.pinnedTabs.includes(tabId)) return;
    
    const newPinnedTabs = state.pinnedTabs.filter((id) => id !== tabId);
    setState("pinnedTabs", newPinnedTabs);
    savePinnedTabs(newPinnedTabs);
  };

  const togglePinTab = (tabId: string) => {
    if (state.pinnedTabs.includes(tabId)) {
      unpinTab(tabId);
    } else {
      pinTab(tabId);
    }
  };

  const isTabPinned = (tabId: string): boolean => {
    return state.pinnedTabs.includes(tabId);
  };

  // ============================================================================
  // Preview Tabs (VS Code-style preview mode)
  // ============================================================================

  const isPreviewTab = (tabId: string): boolean => {
    return state.previewTab === tabId;
  };

  const promotePreviewToPermanent = (fileId?: string) => {
    const targetId = fileId || state.previewTab;
    if (!targetId) return;
    
    // Only promote if it's actually the preview tab
    if (state.previewTab === targetId) {
      setState("previewTab", null);
    }
  };

  const openPreview = async (path: string, groupId?: string) => {
    const targetGroupId = groupId || state.activeGroupId;
    
    // Check if file is already open
    const existing = state.openFiles.find((f) => f.path === path);
    if (existing) {
      // If it's already open (not as preview), just activate it
      batch(() => {
        setState("activeFileId", existing.id);
        setState("activeGroupId", targetGroupId);
        setState(
          "groups",
          (g) => g.id === targetGroupId,
          produce((group) => {
            if (!group.fileIds.includes(existing.id)) {
              group.fileIds.push(existing.id);
            }
            group.activeFileId = existing.id;
          })
        );
      });
      return;
    }

    setState("isOpening", true);
    try {
      const content = await invoke<string>("fs_read_file", { path });
      // Extract filename from path (handles both / and \ separators)
      const name = path.split(/[/\\]/).pop() || path;
      
      // If there's an existing preview tab, replace its content instead of closing/reopening
      // This prevents the "flash" effect in the Open Editors list
      if (state.previewTab) {
        const previewFileIndex = state.openFiles.findIndex((f) => f.id === state.previewTab);
        if (previewFileIndex !== -1) {
          const previewId = state.previewTab;
          // Replace the preview tab's content in a single batch update
          batch(() => {
            setState("openFiles", previewFileIndex, {
              id: previewId,
              path,
              name,
              content,
              language: detectLanguage(name),
              modified: false,
              cursors: [{ line: 1, column: 1 }],
              selections: [],
            });
            setState("activeFileId", previewId);
            setState("activeGroupId", targetGroupId);
            setState(
              "groups",
              (g) => g.id === targetGroupId,
              produce((group) => {
                if (!group.fileIds.includes(previewId)) {
                  group.fileIds.push(previewId);
                }
                group.activeFileId = previewId;
              })
            );
          });
          return;
        }
      }

      // No existing preview tab, create a new one
      const id = `file-${generateId()}`;

      const newFile: OpenFile = {
        id,
        path,
        name,
        content,
        language: detectLanguage(name),
        modified: false,
        cursors: [{ line: 1, column: 1 }],
        selections: [],
      };

      // Batch all state updates for opening a preview file
      batch(() => {
        setState("openFiles", (files) => [...files, newFile]);
        setState("activeFileId", id);
        setState("activeGroupId", targetGroupId);
        setState("previewTab", id); // Mark as preview tab
        setState(
          "groups",
          (g) => g.id === targetGroupId,
          produce((group) => {
            group.fileIds.push(id);
            group.activeFileId = id;
          })
        );
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Failed to open preview file:", errorMessage);
      
      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: {
            type: "error",
            title: "Failed to open file",
            message: `Could not open "${path.split("/").pop() || path.split("\\").pop() || path}": ${errorMessage}`,
          },
        })
      );
    } finally {
      setState("isOpening", false);
    }
  };

  const splitEditor = (direction: SplitDirection) => {
    const activeGroup = state.groups.find((g) => g.id === state.activeGroupId);
    if (!activeGroup || activeGroup.fileIds.length === 0) return;

    const newGroupId = `group-${generateId()}`;
    const splitId = `split-${generateId()}`;
    
    const activeFileId = activeGroup.activeFileId;
    
    const newGroup: EditorGroup = {
      id: newGroupId,
      fileIds: activeFileId ? [activeFileId] : [],
      activeFileId: activeFileId,
      splitRatio: 0.5,
    };

    const newSplit: EditorSplit = {
      id: splitId,
      direction,
      firstGroupId: state.activeGroupId,
      secondGroupId: newGroupId,
      ratio: 0.5,
    };

    // Batch all state updates for splitting
    batch(() => {
      setState("groups", (groups) => [...groups, newGroup]);
      setState("splits", (splits) => [...splits, newSplit]);
      setState("activeGroupId", newGroupId);
    });
  };

  const closeGroup = (groupId: string) => {
    if (state.groups.length <= 1) return;
    
    const splitIndex = state.splits.findIndex(
      (s) => s.firstGroupId === groupId || s.secondGroupId === groupId
    );
    
    // Batch all state updates for closing a group
    batch(() => {
      if (splitIndex !== -1) {
        setState("splits", (splits) => splits.filter((_, i) => i !== splitIndex));
      }
      
      setState("groups", (groups) => groups.filter((g) => g.id !== groupId));
      
      if (state.activeGroupId === groupId) {
        const remainingGroup = state.groups.find((g) => g.id !== groupId);
        if (remainingGroup) {
          setState("activeGroupId", remainingGroup.id);
          setState("activeFileId", remainingGroup.activeFileId);
        }
      }
    });
  };

  const setActiveGroup = (groupId: string) => {
    const group = state.groups.find((g) => g.id === groupId);
    
    // Batch active group and file updates
    batch(() => {
      setState("activeGroupId", groupId);
      if (group?.activeFileId) {
        setState("activeFileId", group.activeFileId);
      }
    });
  };

  const moveFileToGroup = (fileId: string, targetGroupId: string) => {
    const sourceGroup = state.groups.find((g) => g.fileIds.includes(fileId));
    if (!sourceGroup || sourceGroup.id === targetGroupId) return;

    // Batch all state updates for moving a file between groups
    batch(() => {
      setState(
        "groups",
        (g) => g.id === sourceGroup.id,
        produce((group) => {
          group.fileIds = group.fileIds.filter((id) => id !== fileId);
          if (group.activeFileId === fileId) {
            group.activeFileId = group.fileIds[0] || null;
          }
        })
      );

      setState(
        "groups",
        (g) => g.id === targetGroupId,
        produce((group) => {
          group.fileIds.push(fileId);
          group.activeFileId = fileId;
        })
      );

      setState("activeGroupId", targetGroupId);
      setState("activeFileId", fileId);
    });
  };

  const updateCursorInfo = (cursorCount: number, selectionCount: number) => {
    // Batch cursor info updates
    batch(() => {
      setState("cursorCount", cursorCount);
      setState("selectionCount", selectionCount);
    });
  };

  const getActiveGroup = () => {
    return state.groups.find((g) => g.id === state.activeGroupId);
  };

  const getGroupFiles = (groupId: string) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return [];
    return group.fileIds
      .map((id) => state.openFiles.find((f) => f.id === id))
      .filter((f): f is OpenFile => f !== undefined);
  };

  const unsplit = () => {
    if (state.groups.length <= 1) return;
    
    const defaultGroup = state.groups[0];
    const allFileIds = new Set<string>();
    
    state.groups.forEach((group) => {
      group.fileIds.forEach((id) => allFileIds.add(id));
    });
    
    // Batch all state updates for unsplitting
    batch(() => {
      setState("groups", [
        {
          ...defaultGroup,
          fileIds: Array.from(allFileIds),
          activeFileId: state.activeFileId,
        },
      ]);
      setState("splits", []);
      setState("activeGroupId", defaultGroup.id);
    });
  };

  const reorderTabs = (sourceFileId: string, targetFileId: string, groupId?: string) => {
    // Find the group containing the source file
    const sourceGroup = state.groups.find((g) => g.fileIds.includes(sourceFileId));
    if (!sourceGroup) return;
    
    // Use provided groupId or source group
    const targetGroupId = groupId || sourceGroup.id;
    const targetGroup = state.groups.find((g) => g.id === targetGroupId);
    if (!targetGroup) return;
    
    // Get the current file order
    const fileIds = [...targetGroup.fileIds];
    
    // Find indices
    const sourceIndex = fileIds.indexOf(sourceFileId);
    const targetIndex = fileIds.indexOf(targetFileId);
    
    if (sourceIndex === -1 || targetIndex === -1) return;
    if (sourceIndex === targetIndex) return;
    
    // Remove source and insert at target position
    fileIds.splice(sourceIndex, 1);
    fileIds.splice(targetIndex, 0, sourceFileId);
    
    // Update the group
    setState(
      "groups",
      (g) => g.id === targetGroupId,
      "fileIds",
      fileIds
    );
  };

  const updateSplitRatio = (splitId: string, ratio: number) => {
    const clampedRatio = Math.max(0.15, Math.min(0.85, ratio));
    setState(
      "splits",
      (s) => s.id === splitId,
      "ratio",
      clampedRatio
    );
  };

  // ============================================================================
  // Grid Layout Operations
  // ============================================================================

  const setUseGridLayout = (use: boolean) => {
    setState("useGridLayout", use);
    try {
      localStorage.setItem("orion_use_grid_layout", use ? "true" : "false");
    } catch (e) {
      console.error("[EditorContext] Failed to save grid layout preference:", e);
    }
    
    // Initialize grid state if switching to grid layout
    if (use && !state.gridState) {
      const activeFile = state.openFiles.find((f) => f.id === state.activeFileId);
      const newGridState = createSingleEditorLayout(activeFile?.id);
      setState("gridState", newGridState);
      saveGridState(newGridState);
    }
  };

  const splitEditorInGrid = (direction: "horizontal" | "vertical", fileId?: string) => {
    if (!state.gridState) {
      // Initialize grid state if not present
      const activeFile = state.openFiles.find((f) => f.id === state.activeFileId);
      const newGridState = createSingleEditorLayout(activeFile?.id);
      setState("gridState", newGridState);
    }
    
    const currentGridState = state.gridState!;
    const activeCellId = currentGridState.activeCell;
    const targetFileId = fileId || state.activeFileId || undefined;
    
    const newGridState = splitCell(currentGridState, activeCellId, direction, targetFileId);
    
    batch(() => {
      setState("gridState", newGridState);
    });
    
    saveGridState(newGridState);
  };

  const closeGridCellAction = (cellId: string) => {
    if (!state.gridState) return;
    
    const newGridState = closeGridCell(state.gridState, cellId);
    
    batch(() => {
      setState("gridState", newGridState);
    });
    
    saveGridState(newGridState);
  };

  const moveEditorToGridCell = (fileId: string, cellId: string) => {
    if (!state.gridState) return;
    
    // Find the cell and update its fileId
    const updateCell = (cell: GridCell): GridCell => {
      if (cell.id === cellId) {
        return { ...cell, fileId };
      }
      if (cell.children) {
        return {
          ...cell,
          children: cell.children.map(updateCell),
        };
      }
      return cell;
    };
    
    const newGridState: EditorGridState = {
      root: updateCell(state.gridState.root),
      activeCell: cellId,
    };
    
    batch(() => {
      setState("gridState", newGridState);
      setState("activeFileId", fileId);
    });
    
    saveGridState(newGridState);
  };

  const updateGridState = (newState: EditorGridState) => {
    batch(() => {
      setState("gridState", newState);
    });
    saveGridState(newState);
  };

  // ============================================================================
  // Event Listeners for Grid Commands
  // ============================================================================

  onMount(() => {
    const handleSplitRight = () => {
      if (state.useGridLayout) {
        splitEditorInGrid("vertical");
      } else {
        splitEditor("vertical");
      }
    };

    const handleSplitDown = () => {
      if (state.useGridLayout) {
        splitEditorInGrid("horizontal");
      } else {
        splitEditor("horizontal");
      }
    };

    const handleEditorSplit = (e: CustomEvent<{ direction: "vertical" | "horizontal" }>) => {
      if (state.useGridLayout) {
        splitEditorInGrid(e.detail.direction);
      } else {
        splitEditor(e.detail.direction);
      }
    };

    // Tab navigation handlers
    const handleNextTab = () => {
      const files = state.openFiles;
      if (files.length < 2) return;
      const currentIndex = files.findIndex(f => f.id === state.activeFileId);
      const nextIndex = (currentIndex + 1) % files.length;
      setActiveFile(files[nextIndex].id);
    };

    const handlePrevTab = () => {
      const files = state.openFiles;
      if (files.length < 2) return;
      const currentIndex = files.findIndex(f => f.id === state.activeFileId);
      const prevIndex = currentIndex <= 0 ? files.length - 1 : currentIndex - 1;
      setActiveFile(files[prevIndex].id);
    };

    // Handle terminal requests for selection
    const handleGetSelectionForTerminal = () => {
      // Dispatch event to Monaco editor to get selection
      window.dispatchEvent(new CustomEvent("monaco:get-selection-for-terminal"));
    };

    // Handle terminal requests for active file path
    const handleGetActiveFileForTerminal = () => {
      const activeFile = state.openFiles.find(f => f.id === state.activeFileId);
      if (activeFile && activeFile.path && !activeFile.path.startsWith("virtual://")) {
        window.dispatchEvent(new CustomEvent("editor:active-file-for-terminal", {
          detail: { filePath: activeFile.path }
        }));
      } else {
        // Notify that no file is available
        window.dispatchEvent(new CustomEvent("notification", {
          detail: {
            type: "warning",
            title: "No file to run",
            message: "Please open a file first to run it in the terminal.",
          }
        }));
      }
    };

    // Handle terminal run active file command (direct dispatch from menu/command palette)
    const handleTerminalRunActiveFile = () => {
      const activeFile = state.openFiles.find(f => f.id === state.activeFileId);
      if (activeFile && activeFile.path && !activeFile.path.startsWith("virtual://")) {
        window.dispatchEvent(new CustomEvent("terminal:run-active-file", {
          detail: { filePath: activeFile.path }
        }));
      } else {
        window.dispatchEvent(new CustomEvent("notification", {
          detail: {
            type: "warning",
            title: "No file to run",
            message: "Please open a file first to run it in the terminal.",
          }
        }));
      }
    };

    window.addEventListener("editor-split", handleEditorSplit as EventListener);
    window.addEventListener("editor:split-right", handleSplitRight);
    window.addEventListener("editor:split-down", handleSplitDown);
    window.addEventListener("editor:next-tab", handleNextTab);
    window.addEventListener("editor:prev-tab", handlePrevTab);
    window.addEventListener("editor:get-selection-for-terminal", handleGetSelectionForTerminal);
    window.addEventListener("editor:get-active-file-for-terminal", handleGetActiveFileForTerminal);
    window.addEventListener("terminal:run-active-file", handleTerminalRunActiveFile);

    onCleanup(() => {
      window.removeEventListener("editor-split", handleEditorSplit as EventListener);
      window.removeEventListener("editor:split-right", handleSplitRight);
      window.removeEventListener("editor:split-down", handleSplitDown);
      window.removeEventListener("editor:next-tab", handleNextTab);
      window.removeEventListener("editor:prev-tab", handlePrevTab);
      window.removeEventListener("editor:get-selection-for-terminal", handleGetSelectionForTerminal);
      window.removeEventListener("editor:get-active-file-for-terminal", handleGetActiveFileForTerminal);
      window.removeEventListener("terminal:run-active-file", handleTerminalRunActiveFile);
    });
  });

  return (
    <EditorContext.Provider
      value={{
        state,
        openFile,
        openVirtualFile,
        closeFile,
        setActiveFile,
        updateFileContent,
        saveFile,
        closeAllFiles,
        splitEditor,
        closeGroup,
        setActiveGroup,
        moveFileToGroup,
        updateCursorInfo,
        getActiveGroup,
        getGroupFiles,
        unsplit,
        reorderTabs,
        updateSplitRatio,
        pinTab,
        unpinTab,
        togglePinTab,
        isTabPinned,
        openPreview,
        promotePreviewToPermanent,
        isPreviewTab,
        // Grid layout
        gridState: state.gridState,
        useGridLayout: state.useGridLayout,
        setUseGridLayout,
        splitEditorInGrid,
        closeGridCell: closeGridCellAction,
        moveEditorToGridCell,
        updateGridState,
        selectors,
      }}
    >
      {props.children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor must be used within EditorProvider");
  }
  return context;
}
