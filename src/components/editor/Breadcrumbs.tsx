import { createSignal, createEffect, onCleanup, onMount, Show, For, createMemo } from "solid-js";
import { Portal } from "solid-js/web";
import { invoke } from "@tauri-apps/api/core";
import { useEditor, OpenFile } from "@/context/EditorContext";
import { useSettings } from "@/context/SettingsContext";
import { useOutline, DocumentSymbol, SymbolKind } from "@/context/OutlineContext";
import { Icon } from "../ui/Icon";
import { getProjectPath } from "@/utils/workspace";
import { useToast } from "@/context/ToastContext";
import { getFileIcon } from "@/utils/fileIcons";
import "@/styles/tabs.css";

// ============================================================================
// VS Code Breadcrumbs Specifications
// ============================================================================
// Height below tabs: 22px
// Icon width: 16px
// Font size: 12px (0.9em for separators)
// Separator: '/' (or '\' for Windows backslash-path)
// Last item padding-right: 8px
// Picker input height: 36px
// Keyboard navigation: Ctrl+Shift+.
// ============================================================================

// ============================================================================
// Types
// ============================================================================

interface PathSegment {
  name: string;
  path: string;
  isFile: boolean;
}

interface SymbolInfo {
  id: string;
  name: string;
  kind: SymbolKind;
  detail?: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  children: SymbolInfo[];
  depth: number;
}

interface SiblingItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface BreadcrumbsProps {
  file: OpenFile | undefined;
  groupId?: string;
  workspaceRoot?: string | null;
}

// Settings interface for breadcrumbs
interface BreadcrumbsSettings {
  enabled: boolean;
  filePath: "on" | "off" | "last";
  symbolPath: "on" | "off" | "last";
  icons: boolean;
}

// ============================================================================
// Symbol Kind Icons and Colors (LSP-compatible)
// ============================================================================

const SYMBOL_ICONS: Record<SymbolKind, string> = {
  file: "F",
  module: "M",
  namespace: "N",
  package: "P",
  class: "C",
  method: "m",
  property: "p",
  field: "f",
  constructor: "c",
  enum: "E",
  interface: "I",
  function: "f",
  variable: "v",
  constant: "K",
  string: "S",
  number: "#",
  boolean: "B",
  array: "[]",
  object: "{}",
  key: "k",
  null: "N",
  enumMember: "e",
  struct: "S",
  event: "e",
  operator: "o",
  typeParameter: "T",
};

const SYMBOL_COLORS: Record<SymbolKind, string> = {
  file: "var(--cortex-text-primary)",
  module: "var(--cortex-text-primary)",
  namespace: "var(--cortex-syntax-function)",
  package: "var(--cortex-syntax-function)",
  class: "var(--cortex-syntax-function)",
  method: "var(--cortex-syntax-function)",
  property: "var(--cortex-syntax-variable)",
  field: "var(--cortex-syntax-variable)",
  constructor: "var(--cortex-syntax-function)",
  enum: "var(--cortex-syntax-function)",
  interface: "var(--cortex-syntax-function)",
  function: "var(--cortex-syntax-function)",
  variable: "var(--cortex-syntax-variable)",
  constant: "var(--cortex-info)",
  string: "var(--cortex-syntax-string)",
  number: "var(--cortex-syntax-number)",
  boolean: "var(--cortex-syntax-keyword)",
  array: "var(--cortex-text-primary)",
  object: "var(--cortex-text-primary)",
  key: "var(--cortex-syntax-variable)",
  null: "var(--cortex-syntax-keyword)",
  enumMember: "var(--cortex-info)",
  struct: "var(--cortex-syntax-function)",
  event: "var(--cortex-syntax-function)",
  operator: "var(--cortex-text-primary)",
  typeParameter: "var(--cortex-syntax-function)",
};

// ============================================================================
// Helper Functions
// ============================================================================

export const copyBreadcrumbsPath = async (filePath: string | undefined): Promise<boolean> => {
  if (!filePath) return false;
  try {
    await navigator.clipboard.writeText(filePath);
    return true;
  } catch {
    return false;
  }
};

export const copyBreadcrumbsRelativePath = async (filePath: string | undefined): Promise<boolean> => {
  if (!filePath) return false;
  const projectPath = getProjectPath();
  try {
    if (projectPath) {
      const normalizedFile = filePath.replace(/\\/g, "/");
      const normalizedProject = projectPath.replace(/\\/g, "/");
      let relativePath = normalizedFile;
      if (normalizedFile.toLowerCase().startsWith(normalizedProject.toLowerCase())) {
        relativePath = normalizedFile.substring(normalizedProject.length).replace(/^[\/\\]/, '');
      }
      await navigator.clipboard.writeText(relativePath);
    } else {
      await navigator.clipboard.writeText(filePath);
    }
    return true;
  } catch {
    return false;
  }
};

export const revealBreadcrumbsInExplorer = async (filePath: string | undefined): Promise<boolean> => {
  if (!filePath) return false;
  try {
    await invoke("fs_reveal_in_explorer", { path: filePath });
    return true;
  } catch {
    return false;
  }
};

// Get file icon path
const getFileIconPath = (filename: string): string => {
  return getFileIcon(filename, false);
};

// Convert DocumentSymbol to SymbolInfo
const convertToSymbolInfo = (symbol: DocumentSymbol, depth: number = 0): SymbolInfo => ({
  id: symbol.id,
  name: symbol.name,
  kind: symbol.kind,
  detail: symbol.detail,
  range: {
    startLine: symbol.range.startLine,
    startColumn: symbol.range.startColumn,
    endLine: symbol.range.endLine,
    endColumn: symbol.range.endColumn,
  },
  children: symbol.children.map(c => convertToSymbolInfo(c, depth + 1)),
  depth,
});

// Find symbol at cursor position
const findSymbolAtPosition = (
  symbols: SymbolInfo[],
  line: number,
  _column: number
): SymbolInfo[] => {
  const path: SymbolInfo[] = [];
  
  const findInSymbols = (syms: SymbolInfo[]): boolean => {
    for (const sym of syms) {
      // Check if cursor is within symbol range
      if (
        line >= sym.range.startLine &&
        line <= sym.range.endLine
      ) {
        path.push(sym);
        // Check children for more specific match
        if (sym.children.length > 0) {
          findInSymbols(sym.children);
        }
        return true;
      }
    }
    return false;
  };
  
  findInSymbols(symbols);
  return path;
};

// Flatten symbols for picker
const flattenSymbols = (symbols: SymbolInfo[], result: SymbolInfo[] = []): SymbolInfo[] => {
  for (const sym of symbols) {
    result.push(sym);
    if (sym.children.length > 0) {
      flattenSymbols(sym.children, result);
    }
  }
  return result;
};

// ============================================================================
// Breadcrumbs Picker Component
// ============================================================================

interface BreadcrumbsPickerProps {
  type: "folder" | "symbol";
  items: SiblingItem[] | SymbolInfo[];
  currentPath?: string;
  currentSymbolId?: string;
  position: { x: number; y: number };
  onSelect: (item: SiblingItem | SymbolInfo) => void;
  onClose: () => void;
}

function BreadcrumbsPicker(props: BreadcrumbsPickerProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  onMount(() => {
    inputRef?.focus();
  });

  // Filter items based on search query
  const filteredItems = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return props.items;
    
    if (props.type === "folder") {
      return (props.items as SiblingItem[]).filter(item =>
        item.name.toLowerCase().includes(query)
      );
    } else {
      return (props.items as SymbolInfo[]).filter(item =>
        item.name.toLowerCase().includes(query)
      );
    }
  });

  // Reset selection when filter changes
  createEffect(() => {
    filteredItems();
    setSelectedIndex(0);
  });

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    const items = filteredItems();
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, items.length - 1));
        scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        if (items[selectedIndex()]) {
          props.onSelect(items[selectedIndex()]);
        }
        break;
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
      case "Home":
        e.preventDefault();
        setSelectedIndex(0);
        scrollToSelected();
        break;
      case "End":
        e.preventDefault();
        setSelectedIndex(items.length - 1);
        scrollToSelected();
        break;
    }
  };

  const scrollToSelected = () => {
    if (listRef) {
      const selected = listRef.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <div
      class="breadcrumbs-picker"
      style={{
        position: "fixed",
        left: `${props.position.x}px`,
        top: `${props.position.y}px`,
        "min-width": "220px",
        "max-width": "400px",
        "max-height": "350px",
        background: "var(--jb-panel)",
        border: "1px solid var(--jb-border-divider)",
        "border-radius": "var(--cortex-radius-md)",
        "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.36)",
        "z-index": "1000",
        overflow: "hidden",
        display: "flex",
        "flex-direction": "column",
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Search input */}
      <div
        style={{
          padding: "8px",
          "border-bottom": "1px solid var(--jb-border-divider)",
        }}
      >
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            padding: "4px 8px",
            background: "var(--jb-surface-base)",
            "border-radius": "var(--cortex-radius-sm)",
            border: "1px solid var(--jb-border-divider)",
          }}
        >
          <Icon name="magnifying-glass" style={{ width: "14px", height: "14px", color: "var(--jb-text-muted-color)", "flex-shrink": "0" }} />
          <input
            ref={inputRef}
            type="text"
            placeholder={props.type === "folder" ? "Search files..." : "Search symbols..."}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            style={{
              flex: "1",
              border: "none",
              background: "transparent",
              color: "var(--jb-text-body-color)",
              "font-size": "12px",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Items list */}
      <div
        ref={listRef}
        style={{
          flex: "1",
          "overflow-y": "auto",
          padding: "4px 0",
        }}
      >
        <Show
          when={filteredItems().length > 0}
          fallback={
            <div
              style={{
                padding: "12px 16px",
                color: "var(--jb-text-muted-color)",
                "font-size": "12px",
                "text-align": "center",
              }}
            >
              No items found
            </div>
          }
        >
          <For each={filteredItems()}>
            {(item, index) => {
              const isSelected = () => index() === selectedIndex();
              const isCurrent = () => {
                if (props.type === "folder") {
                  return (item as SiblingItem).path === props.currentPath;
                } else {
                  return (item as SymbolInfo).id === props.currentSymbolId;
                }
              };

              if (props.type === "folder") {
                const folderItem = item as SiblingItem;
                return (
                  <button
                    data-selected={isSelected()}
                    onClick={() => props.onSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index())}
                    style={{
                      width: "100%",
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                      padding: "4px 12px",
                      height: "24px",
                      border: "none",
                      background: isSelected() 
                        ? "var(--jb-bg-hover)" 
                        : "transparent",
                      color: isCurrent() 
                        ? "var(--jb-border-focus)" 
                        : "var(--jb-text-body-color)",
                      cursor: "pointer",
                      "text-align": "left",
                    }}
                  >
                    <Show
                      when={folderItem.isDirectory}
                      fallback={
                        <img 
                          src={getFileIconPath(folderItem.name)} 
                          alt="" 
                          style={{ width: "16px", height: "16px", "flex-shrink": "0" }}
                        />
                      }
                    >
                      <Icon name="folder" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--cortex-warning)" }} />
                    </Show>
                    <span
                      style={{
                        "font-size": "12px",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                      }}
                    >
                      {folderItem.name}
                    </span>
                  </button>
                );
              } else {
                const symbolItem = item as SymbolInfo;
                return (
                  <button
                    data-selected={isSelected()}
                    onClick={() => props.onSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index())}
                    style={{
                      width: "100%",
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                      padding: "4px 12px",
                      "padding-left": `${12 + symbolItem.depth * 12}px`,
                      height: "24px",
                      border: "none",
                      background: isSelected() 
                        ? "var(--jb-bg-hover)" 
                        : "transparent",
                      color: isCurrent() 
                        ? "var(--jb-border-focus)" 
                        : "var(--jb-text-body-color)",
                      cursor: "pointer",
                      "text-align": "left",
                    }}
                  >
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        "flex-shrink": "0",
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "center",
                        "font-size": "10px",
                        "font-weight": "600",
                        "border-radius": "var(--cortex-radius-sm)",
                        background: "var(--jb-surface-base)",
                        color: SYMBOL_COLORS[symbolItem.kind] || "var(--jb-text-muted-color)",
                      }}
                    >
                      {SYMBOL_ICONS[symbolItem.kind] || "?"}
                    </span>
                    <span
                      style={{
                        "font-size": "12px",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                        flex: "1",
                      }}
                    >
                      {symbolItem.name}
                    </span>
                    <span
                      style={{
                        "font-size": "10px",
                        color: "var(--jb-text-muted-color)",
                        "margin-left": "auto",
                      }}
                    >
                      {symbolItem.kind}
                    </span>
                  </button>
                );
              }
            }}
          </For>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Main Breadcrumbs Component
// ============================================================================

export function Breadcrumbs(props: BreadcrumbsProps) {
  const { openFile } = useEditor();
  const toast = useToast();
  const outline = useOutline();
  const settingsContext = useSettings();

  // State
  const [segments, setSegments] = createSignal<PathSegment[]>([]);
  const [symbolPath, setSymbolPath] = createSignal<SymbolInfo[]>([]);
  const [allSymbols, setAllSymbols] = createSignal<SymbolInfo[]>([]);
  const [dropdownOpen, setDropdownOpen] = createSignal<number | "symbol" | null>(null);
  const [siblings, setSiblings] = createSignal<SiblingItem[]>([]);
  const [loadingSiblings, setLoadingSiblings] = createSignal(false);
  const [contextMenuPos, setContextMenuPos] = createSignal<{ x: number; y: number } | null>(null);
  const [pickerPosition, setPickerPosition] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFocused, setIsFocused] = createSignal(false);
  const [focusedIndex, setFocusedIndex] = createSignal<number>(-1);
  const [cursorPosition, setCursorPosition] = createSignal<{ line: number; column: number }>({ line: 1, column: 1 });

  let breadcrumbsRef: HTMLDivElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;
  let contextMenuRef: HTMLDivElement | undefined;

  // Get breadcrumbs settings
  const breadcrumbsSettings = createMemo((): BreadcrumbsSettings => {
    const theme = settingsContext.effectiveSettings()?.theme;
    // Use the detailed breadcrumbs settings if available, otherwise fall back to legacy breadcrumbsEnabled
    const breadcrumbsConfig = theme?.breadcrumbs;
    return {
      enabled: breadcrumbsConfig?.enabled ?? theme?.breadcrumbsEnabled ?? true,
      filePath: breadcrumbsConfig?.filePath ?? "on",
      symbolPath: breadcrumbsConfig?.symbolPath ?? "on",
      icons: breadcrumbsConfig?.icons ?? true,
    };
  });

  // Check if breadcrumbs are enabled
  const isEnabled = () => breadcrumbsSettings().enabled;

  // Build path segments from file path
  createEffect(() => {
    const file = props.file;
    if (!file?.path) {
      setSegments([]);
      return;
    }

    const normalizedFilePath = file.path.replace(/\\/g, "/");
    let workspaceRoot = props.workspaceRoot?.replace(/\\/g, "/") || null;
    
    if (!workspaceRoot) {
      const storedProject = getProjectPath();
      if (storedProject) {
        workspaceRoot = storedProject.replace(/\\/g, "/");
      }
    }
    
    let relativePath = normalizedFilePath;
    if (workspaceRoot && normalizedFilePath.toLowerCase().startsWith(workspaceRoot.toLowerCase())) {
      relativePath = normalizedFilePath.substring(workspaceRoot.length);
      if (relativePath.startsWith("/")) {
        relativePath = relativePath.substring(1);
      }
    }
    
    const isAbsolutePath = /^[A-Za-z]:/.test(relativePath) || relativePath.startsWith("/");
    if (isAbsolutePath) {
      const parts = normalizedFilePath.split("/").filter(Boolean);
      if (parts.length > 2) {
        relativePath = parts.slice(-2).join("/");
      } else {
        relativePath = parts.join("/");
      }
    }

    const pathParts = relativePath.split("/").filter(Boolean);
    const newSegments: PathSegment[] = [];
    const basePath = workspaceRoot || "";
    let currentPath = basePath;
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      newSegments.push({
        name: part,
        path: currentPath,
        isFile: i === pathParts.length - 1,
      });
    }

    // Apply filePath setting
    const settings = breadcrumbsSettings();
    if (settings.filePath === "off") {
      setSegments([]);
    } else if (settings.filePath === "last" && newSegments.length > 0) {
      setSegments([newSegments[newSegments.length - 1]]);
    } else {
      setSegments(newSegments);
    }
  });

  // Update symbols from OutlineContext
  createEffect(() => {
    const symbols = outline.state.symbols;
    if (symbols && symbols.length > 0) {
      const converted = symbols.map(s => convertToSymbolInfo(s));
      setAllSymbols(flattenSymbols(converted));
    } else {
      setAllSymbols([]);
    }
  });

  // Update symbol path on cursor change
  createEffect(() => {
    const pos = cursorPosition();
    const symbols = outline.state.symbols;
    
    if (!symbols || symbols.length === 0) {
      setSymbolPath([]);
      return;
    }

    const converted = symbols.map(s => convertToSymbolInfo(s));
    const path = findSymbolAtPosition(converted, pos.line - 1, pos.column - 1);
    
    // Apply symbolPath setting
    const settings = breadcrumbsSettings();
    if (settings.symbolPath === "off") {
      setSymbolPath([]);
    } else if (settings.symbolPath === "last" && path.length > 0) {
      setSymbolPath([path[path.length - 1]]);
    } else {
      setSymbolPath(path);
    }
  });

  // Listen for cursor position changes
  createEffect(() => {
    const handleCursorChange = (e: CustomEvent<{ line: number; column: number }>) => {
      if (e.detail) {
        setCursorPosition({ line: e.detail.line ?? 1, column: e.detail.column ?? 1 });
      }
    };

    window.addEventListener("editor-cursor-change", handleCursorChange as EventListener);

    onCleanup(() => {
      window.removeEventListener("editor-cursor-change", handleCursorChange as EventListener);
    });
  });

  // Close dropdown on outside click
  createEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node) && 
          breadcrumbsRef && !breadcrumbsRef.contains(e.target as Node)) {
        setDropdownOpen(null);
      }
    };

    if (dropdownOpen() !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
    });
  });

  // Close context menu on outside click
  createEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef && !contextMenuRef.contains(e.target as Node)) {
        setContextMenuPos(null);
      }
    };

    if (contextMenuPos() !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
    });
  });

  // Keyboard navigation: Ctrl+Shift+.
  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus breadcrumbs: Ctrl+Shift+.
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === ".") {
        e.preventDefault();
        setIsFocused(true);
        setFocusedIndex(0);
        breadcrumbsRef?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  // Handle breadcrumbs keyboard navigation when focused
  const handleBreadcrumbsKeyDown = (e: KeyboardEvent) => {
    if (!isFocused()) return;

    const totalItems = segments().length + symbolPath().length;
    const currentIndex = focusedIndex();

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        setFocusedIndex(Math.max(0, currentIndex - 1));
        break;
      case "ArrowRight":
        e.preventDefault();
        setFocusedIndex(Math.min(totalItems - 1, currentIndex + 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        const segs = segments();
        if (currentIndex < segs.length) {
          handleSegmentClick(currentIndex, segs[currentIndex]);
        } else {
          const symbolIndex = currentIndex - segs.length;
          if (symbolPath()[symbolIndex]) {
            handleSymbolClick(symbolIndex);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsFocused(false);
        setDropdownOpen(null);
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(totalItems - 1);
        break;
    }
  };

  // Command events
  createEffect(() => {
    const handleCopyPathCommand = async () => {
      const filePath = props.file?.path;
      const success = await copyBreadcrumbsPath(filePath);
      if (success) {
        toast.success("Path copied to clipboard");
      } else if (!filePath) {
        toast.warning("No file open");
      } else {
        toast.error("Failed to copy path");
      }
    };

    const handleCopyRelativePathCommand = async () => {
      const filePath = props.file?.path;
      const success = await copyBreadcrumbsRelativePath(filePath);
      if (success) {
        toast.success("Relative path copied to clipboard");
      } else if (!filePath) {
        toast.warning("No file open");
      } else {
        toast.error("Failed to copy path");
      }
    };

    const handleRevealCommand = async () => {
      const filePath = props.file?.path;
      const success = await revealBreadcrumbsInExplorer(filePath);
      if (!success) {
        if (!filePath) {
          toast.warning("No file open");
        } else {
          toast.error("Failed to reveal in explorer");
        }
      }
    };

    const handleFocusBreadcrumbs = () => {
      setIsFocused(true);
      setFocusedIndex(0);
      breadcrumbsRef?.focus();
    };

    const handleToggleBreadcrumbs = async () => {
      const currentEnabled = breadcrumbsSettings().enabled;
      await settingsContext.updateThemeSetting("breadcrumbsEnabled", !currentEnabled);
      toast.info(currentEnabled ? "Breadcrumbs disabled" : "Breadcrumbs enabled");
    };

    window.addEventListener("breadcrumbs:copy-path", handleCopyPathCommand);
    window.addEventListener("breadcrumbs:copy-relative-path", handleCopyRelativePathCommand);
    window.addEventListener("breadcrumbs:reveal-in-explorer", handleRevealCommand);
    window.addEventListener("breadcrumbs:focus", handleFocusBreadcrumbs);
    window.addEventListener("breadcrumbs:toggle", handleToggleBreadcrumbs);

    onCleanup(() => {
      window.removeEventListener("breadcrumbs:copy-path", handleCopyPathCommand);
      window.removeEventListener("breadcrumbs:copy-relative-path", handleCopyRelativePathCommand);
      window.removeEventListener("breadcrumbs:reveal-in-explorer", handleRevealCommand);
      window.removeEventListener("breadcrumbs:focus", handleFocusBreadcrumbs);
      window.removeEventListener("breadcrumbs:toggle", handleToggleBreadcrumbs);
    });
  });

  // Context menu
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setDropdownOpen(null);
  };

  const handleCopyPath = async () => {
    const success = await copyBreadcrumbsPath(props.file?.path);
    if (success) {
      toast.success("Path copied to clipboard");
    } else {
      toast.error("Failed to copy path");
    }
    setContextMenuPos(null);
  };

  const handleCopyRelativePath = async () => {
    const success = await copyBreadcrumbsRelativePath(props.file?.path);
    if (success) {
      toast.success("Relative path copied to clipboard");
    } else {
      toast.error("Failed to copy path");
    }
    setContextMenuPos(null);
  };

  const handleRevealInExplorer = async () => {
    const success = await revealBreadcrumbsInExplorer(props.file?.path);
    if (!success) {
      toast.error("Failed to reveal in explorer");
    }
    setContextMenuPos(null);
  };

  // Fetch siblings for folder picker
  const fetchSiblings = async (path: string) => {
    setLoadingSiblings(true);
    try {
      const parentPath = path.split("/").slice(0, -1).join("/") || path.split("\\").slice(0, -1).join("\\") || ".";
      
      const entries = await invoke<Array<{ name: string; path: string; is_directory: boolean }>>("fs_list_directory", { path: parentPath });
      
      const items: SiblingItem[] = entries.map((entry) => ({
        name: entry.name,
        path: entry.path,
        isDirectory: entry.is_directory,
      }));
      
      items.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      
      setSiblings(items);
    } catch {
      setSiblings([]);
    } finally {
      setLoadingSiblings(false);
    }
  };

  // Drag and drop
  const handleDragStart = (e: DragEvent, segment: PathSegment) => {
    if (!e.dataTransfer) return;
    
    e.dataTransfer.setData('text/plain', segment.path);
    e.dataTransfer.setData('application/cortex-path', JSON.stringify({
      path: segment.path,
      isFile: segment.isFile,
      name: segment.name,
    }));
    
    e.dataTransfer.effectAllowed = 'copyMove';
    
    const ghost = document.createElement('div');
    ghost.className = 'breadcrumb-drag-ghost';
    ghost.textContent = segment.name;
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    ghost.style.left = '-1000px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    
    setTimeout(() => ghost.remove(), 0);
  };

  // Segment click handler
  const handleSegmentClick = (index: number, segment: PathSegment, e?: MouseEvent) => {
    if (e) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setPickerPosition({ x: rect.left, y: rect.bottom + 4 });
    }
    
    if (dropdownOpen() === index) {
      setDropdownOpen(null);
    } else {
      setDropdownOpen(index);
      fetchSiblings(segment.path);
    }
  };

  // Symbol click handler
  const handleSymbolClick = (_symbolIndex: number, e?: MouseEvent) => {
    if (e) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setPickerPosition({ x: rect.left, y: rect.bottom + 4 });
    }
    
    if (dropdownOpen() === "symbol") {
      setDropdownOpen(null);
    } else {
      setDropdownOpen("symbol");
    }
  };

  // Handle sibling selection
  const handleSiblingSelect = async (item: SiblingItem | SymbolInfo) => {
    if ("isDirectory" in item) {
      // It's a SiblingItem
      if (item.isDirectory) {
        window.dispatchEvent(
          new CustomEvent("file-explorer:reveal", {
            detail: { path: item.path },
          })
        );
      } else {
        await openFile(item.path, props.groupId);
      }
    }
    setDropdownOpen(null);
  };

  // Handle symbol selection
  const handleSymbolSelect = (item: SiblingItem | SymbolInfo) => {
    if ("kind" in item) {
      // It's a SymbolInfo - navigate to it
      outline.navigateToSymbol({
        id: item.id,
        name: item.name,
        kind: item.kind,
        detail: item.detail,
        range: {
          startLine: item.range.startLine,
          startColumn: item.range.startColumn,
          endLine: item.range.endLine,
          endColumn: item.range.endColumn,
        },
        selectionRange: {
          startLine: item.range.startLine,
          startColumn: item.range.startColumn,
          endLine: item.range.endLine,
          endColumn: item.range.endColumn,
        },
        children: [],
        depth: item.depth,
        expanded: true,
      });
    }
    setDropdownOpen(null);
  };

  // Truncate segments for display
  const truncateSegments = (segs: PathSegment[]): PathSegment[] => {
    const MAX_SEGMENTS = 6;
    if (segs.length <= MAX_SEGMENTS) return segs;

    const start = segs.slice(0, 2);
    const end = segs.slice(-3);
    const ellipsis: PathSegment = {
      name: "...",
      path: "",
      isFile: false,
    };

    return [...start, ellipsis, ...end];
  };

  // Don't render if disabled
  if (!isEnabled()) {
    return null;
  }

  return (
    <div
      ref={breadcrumbsRef}
      class="breadcrumbs-below-tabs breadcrumbs-control"
      style={{
        display: "flex",
        "align-items": "center",
        height: "22px",
        "min-height": "22px",
        "line-height": "22px",
        padding: "0 8px",
        background: "var(--jb-panel)",
        "font-size": "12px",
        overflow: "hidden",
        cursor: "default",
        outline: isFocused() ? "1px solid var(--jb-border-focus)" : "none",
        "outline-offset": "-1px",
      }}
      tabIndex={0}
      onContextMenu={handleContextMenu}
      onKeyDown={handleBreadcrumbsKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        if (dropdownOpen() === null) {
          setIsFocused(false);
        }
      }}
    >
      <Show when={props.file} fallback={
        <span style={{ color: "var(--jb-text-muted-color)", "font-size": "12px" }}>
          No file open
        </span>
      }>
        {/* File path segments */}
        <div style={{ display: "flex", "align-items": "center", overflow: "hidden" }}>
          <For each={truncateSegments(segments())}>
            {(segment, index) => (
              <>
                <Show when={index() > 0}>
                  <span
                    class="breadcrumb-separator"
                    style={{ 
                      color: "var(--jb-text-muted-color)",
                      margin: "0 2px",
                      "user-select": "none",
                    }}
                  >
                    /
                  </span>
                </Show>
                
                <Show
                  when={segment.name !== "..."}
                  fallback={
                    <span
                      style={{ 
                        color: "var(--jb-text-muted-color)",
                        padding: "0 4px",
                        "font-size": "12px",
                      }}
                    >
                      ...
                    </span>
                  }
                >
                  <div 
                    class="breadcrumb-item breadcrumb-segment" 
                    style={{ 
                      display: "flex",
                      "align-items": "center",
                      gap: "4px",
                      padding: "0 4px",
                      height: "100%",
                      cursor: "pointer",
                      "border-radius": "var(--cortex-radius-sm)",
                      "white-space": "nowrap",
                      background: (dropdownOpen() === index() || (isFocused() && focusedIndex() === index())) 
                        ? "var(--jb-bg-hover)" 
                        : "transparent",
                    }}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, segment)}
                    onClick={(e) => handleSegmentClick(index(), segment, e)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-bg-hover)")}
                    onMouseLeave={(e) => {
                      if (dropdownOpen() !== index() && !(isFocused() && focusedIndex() === index())) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <Show when={breadcrumbsSettings().icons}>
                      <Show when={segment.isFile} fallback={
                        <Icon name="folder" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--cortex-warning)" }} />
                      }>
                        <img 
                          src={getFileIconPath(segment.name)} 
                          alt="" 
                          style={{ width: "16px", height: "16px", "flex-shrink": "0" }}
                        />
                      </Show>
                    </Show>
                    <span 
                      style={{ 
                        "font-size": "12px",
                        "max-width": "120px",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                        color: segment.isFile ? "var(--jb-text-body-color)" : "var(--jb-text-muted-color)",
                        "font-weight": segment.isFile && props.file?.modified ? "600" : "normal",
                      }}
                    >
                      {segment.name}
                    </span>
                    <Icon name="chevron-down"
                      style={{
                        width: "12px",
                        height: "12px",
                        color: "var(--jb-text-muted-color)",
                        transition: "transform 150ms ease",
                        transform: dropdownOpen() === index() ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  </div>
                </Show>
              </>
            )}
          </For>
        </div>

        {/* Symbol path */}
        <Show when={symbolPath().length > 0}>
          <For each={symbolPath()}>
            {(symbol, index) => {
              const segmentsLength = segments().length;
              const globalIndex = segmentsLength + index();
              
              return (
                <>
                  <span
                    class="breadcrumb-separator"
                    style={{ 
                      color: "var(--jb-text-muted-color)",
                      margin: "0 2px",
                      "user-select": "none",
                    }}
                  >
                    <Icon name="chevron-right" style={{ width: "12px", height: "12px" }} />
                  </span>
                  
                  <div 
                    class="breadcrumb-item breadcrumb-symbol" 
                    style={{ 
                      display: "flex",
                      "align-items": "center",
                      gap: "4px",
                      padding: "0 4px",
                      "padding-right": index() === symbolPath().length - 1 ? "8px" : "4px",
                      height: "100%",
                      cursor: "pointer",
                      "border-radius": "var(--cortex-radius-sm)",
                      "white-space": "nowrap",
                      background: (dropdownOpen() === "symbol" && index() === symbolPath().length - 1) || 
                                  (isFocused() && focusedIndex() === globalIndex)
                        ? "var(--jb-bg-hover)" 
                        : "transparent",
                    }}
                    onClick={(e) => handleSymbolClick(index(), e)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-bg-hover)")}
                    onMouseLeave={(e) => {
                      if (!(dropdownOpen() === "symbol" && index() === symbolPath().length - 1) && 
                          !(isFocused() && focusedIndex() === globalIndex)) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <Show when={breadcrumbsSettings().icons}>
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          "flex-shrink": "0",
                          display: "flex",
                          "align-items": "center",
                          "justify-content": "center",
                          "font-size": "10px",
                          "font-weight": "600",
                          "border-radius": "var(--cortex-radius-sm)",
                          background: "var(--jb-surface-base)",
                          color: SYMBOL_COLORS[symbol.kind] || "var(--jb-text-muted-color)",
                        }}
                      >
                        {SYMBOL_ICONS[symbol.kind] || "?"}
                      </span>
                    </Show>
                    <span 
                      style={{ 
                        "font-size": "12px",
                        "max-width": "150px",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                        color: SYMBOL_COLORS[symbol.kind] || "var(--jb-text-body-color)",
                        "font-weight": "500",
                      }}
                    >
                      {symbol.name}
                    </span>
                    <Show when={index() === symbolPath().length - 1}>
                      <Icon name="chevron-down"
                        style={{
                          width: "12px",
                          height: "12px",
                          color: "var(--jb-text-muted-color)",
                          transition: "transform 150ms ease",
                          transform: dropdownOpen() === "symbol" ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                    </Show>
                  </div>
                </>
              );
            }}
          </For>
        </Show>
      </Show>

      {/* Folder Picker Portal */}
      <Show when={typeof dropdownOpen() === "number" && !loadingSiblings()}>
        <Portal>
          <div
            ref={dropdownRef}
            style={{ position: "fixed", "z-index": "1000", left: "0", top: "0", width: "100%", height: "100%" }}
            onClick={() => setDropdownOpen(null)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <BreadcrumbsPicker
                type="folder"
                items={siblings()}
                currentPath={segments()[dropdownOpen() as number]?.path}
                position={pickerPosition()}
                onSelect={handleSiblingSelect}
                onClose={() => setDropdownOpen(null)}
              />
            </div>
          </div>
        </Portal>
      </Show>

      {/* Symbol Picker Portal */}
      <Show when={dropdownOpen() === "symbol"}>
        <Portal>
          <div
            ref={dropdownRef}
            style={{ position: "fixed", "z-index": "1000", left: "0", top: "0", width: "100%", height: "100%" }}
            onClick={() => setDropdownOpen(null)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <BreadcrumbsPicker
                type="symbol"
                items={allSymbols()}
                currentSymbolId={symbolPath()[symbolPath().length - 1]?.id}
                position={pickerPosition()}
                onSelect={handleSymbolSelect}
                onClose={() => setDropdownOpen(null)}
              />
            </div>
          </div>
        </Portal>
      </Show>

      {/* Context Menu */}
      <Show when={contextMenuPos()}>
        <Portal>
          <div
            ref={contextMenuRef}
            class="breadcrumb-dropdown"
            style={{
              position: "fixed",
              left: `${contextMenuPos()!.x}px`,
              top: `${contextMenuPos()!.y}px`,
              "min-width": "180px",
              background: "var(--jb-panel)",
              border: "1px solid var(--jb-border-divider)",
              "border-radius": "var(--cortex-radius-md)",
              "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.36)",
              padding: "4px 0",
              "z-index": "1000",
            }}
          >
            <button
              class="breadcrumb-dropdown-item"
              style={{ 
                width: "100%",
                height: "24px",
                padding: "0 12px",
                display: "flex",
                "align-items": "center",
                gap: "8px",
                cursor: "pointer",
                color: "var(--jb-text-body-color)", 
                "font-size": "12px",
                border: "none",
                background: "transparent",
                "text-align": "left",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={handleCopyPath}
            >
              <Icon name="copy" style={{ width: "14px", height: "14px", "flex-shrink": "0", color: "var(--jb-text-muted-color)" }} />
              <span>Copy Path</span>
            </button>
            <button
              class="breadcrumb-dropdown-item"
              style={{ 
                width: "100%",
                height: "24px",
                padding: "0 12px",
                display: "flex",
                "align-items": "center",
                gap: "8px",
                cursor: "pointer",
                color: "var(--jb-text-body-color)", 
                "font-size": "12px",
                border: "none",
                background: "transparent",
                "text-align": "left",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={handleCopyRelativePath}
            >
              <Icon name="copy" style={{ width: "14px", height: "14px", "flex-shrink": "0", color: "var(--jb-text-muted-color)" }} />
              <span>Copy Relative Path</span>
            </button>
            <div
              style={{
                height: "0",
                "border-bottom": "1px solid var(--jb-border-divider)",
                margin: "4px 0",
              }}
            />
            <button
              class="breadcrumb-dropdown-item"
              style={{ 
                width: "100%",
                height: "24px",
                padding: "0 12px",
                display: "flex",
                "align-items": "center",
                gap: "8px",
                cursor: "pointer",
                color: "var(--jb-text-body-color)", 
                "font-size": "12px",
                border: "none",
                background: "transparent",
                "text-align": "left",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--jb-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={handleRevealInExplorer}
            >
              <Icon name="arrow-up-right-from-square" style={{ width: "14px", height: "14px", "flex-shrink": "0", color: "var(--jb-text-muted-color)" }} />
              <span>Reveal in File Explorer</span>
            </button>
          </div>
        </Portal>
      </Show>
    </div>
  );
}

export default Breadcrumbs;

