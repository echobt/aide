import { createSignal, createMemo, For, Show, onMount, onCleanup, JSX } from "solid-js";
import { useKeymap, Keystroke, Keybinding, CommandBinding } from "../../context/KeymapContext";
import {
  KeybindingSource,
  KeybindingSortField,
  KeybindingSortOrder,
  RecordedKey,
} from "../../types/keybindings";
import {
  detectConflicts,
} from "../../utils/keybindingResolver";

// ============================================================================
// Types
// ============================================================================

interface KeybindingTableItem {
  id: string;
  command: string;
  commandTitle: string;
  category: string;
  keybinding: string;
  when: string;
  source: KeybindingSource;
  isDefault: boolean;
  isUserDefined: boolean;
  hasConflict: boolean;
  conflictsWith: string[];
  binding: CommandBinding;
}

type FilterSource = "all" | "user" | "default" | "extension";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    "background-color": "var(--vscode-editor-background, var(--cortex-bg-primary))",
    color: "var(--vscode-editor-foreground, var(--cortex-text-primary))",
    "font-family": "var(--vscode-font-family, 'Segoe UI', sans-serif)",
    "font-size": "13px",
  } as JSX.CSSProperties,

  toolbar: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    "border-bottom": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
    "flex-wrap": "wrap",
  } as JSX.CSSProperties,

  searchContainer: {
    display: "flex",
    "align-items": "center",
    flex: "1",
    "min-width": "200px",
    "max-width": "400px",
    position: "relative",
  } as JSX.CSSProperties,

  searchInput: {
    width: "100%",
    padding: "6px 32px 6px 8px",
    border: "1px solid var(--vscode-input-border, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-sm)",
    "background-color": "var(--vscode-input-background, var(--cortex-bg-hover))",
    color: "var(--vscode-input-foreground, var(--cortex-text-primary))",
    "font-size": "13px",
    outline: "none",
  } as JSX.CSSProperties,

  searchIcon: {
    position: "absolute",
    right: "8px",
    opacity: "0.6",
    "pointer-events": "none",
  } as JSX.CSSProperties,

  filterContainer: {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  } as JSX.CSSProperties,

  filterButton: {
    padding: "4px 8px",
    border: "1px solid transparent",
    "border-radius": "var(--cortex-radius-sm)",
    "background-color": "transparent",
    color: "var(--vscode-foreground, var(--cortex-text-primary))",
    cursor: "pointer",
    "font-size": "12px",
    transition: "background-color 0.1s",
  } as JSX.CSSProperties,

  filterButtonActive: {
    "background-color": "var(--vscode-button-background, var(--cortex-info))",
    color: "var(--vscode-button-foreground, var(--cortex-text-primary))",
  } as JSX.CSSProperties,

  tableContainer: {
    flex: "1",
    overflow: "auto",
  } as JSX.CSSProperties,

  table: {
    width: "100%",
    "border-collapse": "collapse",
    "table-layout": "fixed",
  } as JSX.CSSProperties,

  tableHeader: {
    position: "sticky",
    top: "0",
    "background-color": "var(--vscode-editorWidget-background, var(--cortex-bg-primary))",
    "z-index": "1",
  } as JSX.CSSProperties,

  th: {
    padding: "8px 12px",
    "text-align": "left",
    "font-weight": "600",
    "border-bottom": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
    cursor: "pointer",
    "user-select": "none",
    "white-space": "nowrap",
  } as JSX.CSSProperties,

  thCommand: {
    width: "35%",
  } as JSX.CSSProperties,

  thKeybinding: {
    width: "25%",
  } as JSX.CSSProperties,

  thWhen: {
    width: "25%",
  } as JSX.CSSProperties,

  thSource: {
    width: "15%",
  } as JSX.CSSProperties,

  sortIndicator: {
    "margin-left": "4px",
    opacity: "0.7",
  } as JSX.CSSProperties,

  tr: {
    cursor: "pointer",
    transition: "background-color 0.1s",
  } as JSX.CSSProperties,

  trHover: {
    "background-color": "var(--vscode-list-hoverBackground, var(--cortex-bg-hover))",
  } as JSX.CSSProperties,

  trSelected: {
    "background-color": "var(--vscode-list-activeSelectionBackground, var(--cortex-bg-active))",
    color: "var(--vscode-list-activeSelectionForeground, var(--cortex-text-primary))",
  } as JSX.CSSProperties,

  td: {
    padding: "6px 12px",
    "border-bottom": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  } as JSX.CSSProperties,

  commandCell: {
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
  } as JSX.CSSProperties,

  commandTitle: {
    "font-weight": "500",
  } as JSX.CSSProperties,

  commandId: {
    "font-size": "11px",
    opacity: "0.7",
    "font-family": "var(--vscode-editor-font-family, monospace)",
  } as JSX.CSSProperties,

  keybindingCell: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  } as JSX.CSSProperties,

  keybindingBadge: {
    display: "inline-flex",
    "align-items": "center",
    padding: "2px 6px",
    "background-color": "var(--vscode-badge-background, var(--cortex-bg-active))",
    color: "var(--vscode-badge-foreground, var(--cortex-text-primary))",
    "border-radius": "var(--cortex-radius-sm)",
    "font-family": "var(--vscode-editor-font-family, monospace)",
    "font-size": "12px",
  } as JSX.CSSProperties,

  conflictIndicator: {
    color: "var(--vscode-errorForeground, var(--cortex-error))",
    "font-size": "14px",
    cursor: "help",
  } as JSX.CSSProperties,

  sourceCell: {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  } as JSX.CSSProperties,

  sourceBadge: {
    padding: "2px 6px",
    "border-radius": "var(--cortex-radius-lg)",
    "font-size": "11px",
    "text-transform": "capitalize",
  } as JSX.CSSProperties,

  sourceBadgeDefault: {
    "background-color": "var(--vscode-textBlockQuote-background, var(--cortex-bg-hover))",
    color: "var(--vscode-textBlockQuote-border, var(--cortex-text-inactive))",
  } as JSX.CSSProperties,

  sourceBadgeUser: {
    "background-color": "var(--vscode-gitDecoration-modifiedResourceForeground, var(--cortex-warning))",
    color: "var(--vscode-editor-background, var(--cortex-bg-primary))",
  } as JSX.CSSProperties,

  sourceBadgeExtension: {
    "background-color": "var(--vscode-gitDecoration-untrackedResourceForeground, var(--cortex-success))",
    color: "var(--vscode-editor-background, var(--cortex-bg-primary))",
  } as JSX.CSSProperties,

  whenCell: {
    "font-family": "var(--vscode-editor-font-family, monospace)",
    "font-size": "11px",
    opacity: "0.8",
  } as JSX.CSSProperties,

  actionButtons: {
    display: "flex",
    gap: "4px",
    "margin-left": "auto",
  } as JSX.CSSProperties,

  actionButton: {
    padding: "4px 8px",
    border: "none",
    "border-radius": "var(--cortex-radius-sm)",
    "background-color": "var(--vscode-button-secondaryBackground, var(--cortex-bg-hover))",
    color: "var(--vscode-button-secondaryForeground, var(--cortex-text-primary))",
    cursor: "pointer",
    "font-size": "12px",
    display: "flex",
    "align-items": "center",
    gap: "4px",
  } as JSX.CSSProperties,

  primaryButton: {
    "background-color": "var(--vscode-button-background, var(--cortex-info))",
    color: "var(--vscode-button-foreground, var(--cortex-text-primary))",
  } as JSX.CSSProperties,

  dangerButton: {
    "background-color": "var(--vscode-errorForeground, var(--cortex-error))",
    color: "var(--vscode-editor-background, var(--cortex-bg-primary))",
  } as JSX.CSSProperties,

  // Edit Modal Styles
  modalOverlay: {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    "background-color": "rgba(0, 0, 0, 0.5)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "z-index": "1000",
  } as JSX.CSSProperties,

  modal: {
    "background-color": "var(--vscode-editorWidget-background, var(--cortex-bg-primary))",
    border: "1px solid var(--vscode-editorWidget-border, var(--cortex-bg-active))",
    "border-radius": "var(--cortex-radius-sm)",
    padding: "16px",
    "min-width": "400px",
    "max-width": "600px",
    "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.3)",
  } as JSX.CSSProperties,

  modalTitle: {
    "font-size": "14px",
    "font-weight": "600",
    "margin-bottom": "16px",
    "padding-bottom": "8px",
    "border-bottom": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
  } as JSX.CSSProperties,

  modalField: {
    "margin-bottom": "12px",
  } as JSX.CSSProperties,

  modalLabel: {
    display: "block",
    "margin-bottom": "4px",
    "font-size": "12px",
    opacity: "0.8",
  } as JSX.CSSProperties,

  modalInput: {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid var(--vscode-input-border, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-sm)",
    "background-color": "var(--vscode-input-background, var(--cortex-bg-hover))",
    color: "var(--vscode-input-foreground, var(--cortex-text-primary))",
    "font-size": "13px",
    "font-family": "var(--vscode-editor-font-family, monospace)",
    outline: "none",
    "box-sizing": "border-box",
  } as JSX.CSSProperties,

  recordButton: {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    gap: "8px",
    width: "100%",
    padding: "12px",
    border: "2px dashed var(--vscode-input-border, var(--cortex-bg-hover))",
    "border-radius": "var(--cortex-radius-sm)",
    "background-color": "var(--vscode-input-background, var(--cortex-bg-hover))",
    color: "var(--vscode-input-foreground, var(--cortex-text-primary))",
    cursor: "pointer",
    "font-size": "13px",
    transition: "border-color 0.2s, background-color 0.2s",
  } as JSX.CSSProperties,

  recordButtonRecording: {
    "border-color": "var(--vscode-errorForeground, var(--cortex-error))",
    "background-color": "rgba(244, 135, 113, 0.1)",
  } as JSX.CSSProperties,

  recordedKeys: {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    gap: "4px",
    padding: "8px",
    "min-height": "32px",
  } as JSX.CSSProperties,

  recordedKey: {
    padding: "4px 8px",
    "background-color": "var(--vscode-badge-background, var(--cortex-bg-active))",
    color: "var(--vscode-badge-foreground, var(--cortex-text-primary))",
    "border-radius": "var(--cortex-radius-sm)",
    "font-family": "var(--vscode-editor-font-family, monospace)",
    "font-size": "12px",
  } as JSX.CSSProperties,

  modalActions: {
    display: "flex",
    "justify-content": "flex-end",
    gap: "8px",
    "margin-top": "16px",
    "padding-top": "12px",
    "border-top": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
  } as JSX.CSSProperties,

  conflictWarning: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    "background-color": "rgba(244, 135, 113, 0.1)",
    border: "1px solid var(--vscode-errorForeground, var(--cortex-error))",
    "border-radius": "var(--cortex-radius-sm)",
    "margin-top": "8px",
    "font-size": "12px",
    color: "var(--vscode-errorForeground, var(--cortex-error))",
  } as JSX.CSSProperties,

  emptyState: {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    padding: "48px",
    opacity: "0.6",
  } as JSX.CSSProperties,

  emptyStateIcon: {
    "font-size": "48px",
    "margin-bottom": "16px",
  } as JSX.CSSProperties,

  statusBar: {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "6px 12px",
    "border-top": "1px solid var(--vscode-panel-border, var(--cortex-bg-hover))",
    "font-size": "12px",
    opacity: "0.8",
  } as JSX.CSSProperties,
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatRecordedKey(key: RecordedKey): string {
  const parts: string[] = [];
  if (key.ctrlKey) parts.push("Ctrl");
  if (key.altKey) parts.push("Alt");
  if (key.shiftKey) parts.push("Shift");
  if (key.metaKey) parts.push("Meta");

  let keyDisplay = key.key;
  const keyMap: Record<string, string> = {
    ArrowUp: "\u2191",
    ArrowDown: "\u2193",
    ArrowLeft: "\u2190",
    ArrowRight: "\u2192",
    Escape: "Esc",
    Backspace: "\u232B",
    Delete: "Del",
    Enter: "\u21B5",
    Tab: "\u21E5",
    " ": "Space",
    Control: "Ctrl",
    Alt: "Alt",
    Shift: "Shift",
    Meta: "Meta",
  };

  if (keyMap[key.key]) {
    keyDisplay = keyMap[key.key];
  } else if (key.key.length === 1) {
    keyDisplay = key.key.toUpperCase();
  }

  parts.push(keyDisplay);
  return parts.join("+");
}

// ============================================================================
// Component
// ============================================================================

export function KeybindingsEditor() {
  const keymap = useKeymap();

  // State
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchByKeybinding, setSearchByKeybinding] = createSignal(false);
  const [sortField, setSortField] = createSignal<KeybindingSortField>("command");
  const [sortOrder, setSortOrder] = createSignal<KeybindingSortOrder>("asc");
  const [filterSource, setFilterSource] = createSignal<FilterSource>("all");
  const [selectedItemId, setSelectedItemId] = createSignal<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = createSignal<string | null>(null);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = createSignal(false);
  const [editingItem, setEditingItem] = createSignal<KeybindingTableItem | null>(null);
  const [isRecording, setIsRecording] = createSignal(false);
  const [recordedKeys, setRecordedKeys] = createSignal<RecordedKey[]>([]);
  const [editWhenClause, setEditWhenClause] = createSignal("");
  const [editConflicts, setEditConflicts] = createSignal<string[]>([]);

  // Compute conflicts map
  const conflictsMap = createMemo(() => {
    const bindings = keymap.bindings();
    const conflictData: Array<{
      key: string;
      command: string;
      when?: string;
      source: "default" | "user" | "extension";
    }> = [];

    for (const binding of bindings) {
      const effectiveKeybinding = binding.customKeybinding ?? binding.defaultKeybinding;
      if (effectiveKeybinding) {
        const keyStr = keymap.formatKeybinding(effectiveKeybinding);
        conflictData.push({
          key: keyStr,
          command: binding.commandId,
          when: binding.customWhen ?? binding.when,
          source: binding.customKeybinding ? "user" : "default",
        });
      }
    }

    const detectedConflicts = detectConflicts(conflictData);
    const map = new Map<string, string[]>();

    for (const conflict of detectedConflicts) {
      for (const cmd of conflict.conflictingCommands) {
        const existing = map.get(cmd.command) || [];
        const otherCommands = conflict.conflictingCommands
          .filter((c) => c.command !== cmd.command)
          .map((c) => c.command);
        map.set(cmd.command, [...new Set([...existing, ...otherCommands])]);
      }
    }

    return map;
  });

  // Transform bindings to table items
  const tableItems = createMemo((): KeybindingTableItem[] => {
    const bindings = keymap.bindings();
    const conflicts = conflictsMap();

    return bindings.map((binding) => {
      const effectiveKeybinding = binding.customKeybinding ?? binding.defaultKeybinding;
      const effectiveWhen = binding.customWhen ?? binding.when;
      const conflictsWith = conflicts.get(binding.commandId) || [];

      return {
        id: binding.commandId,
        command: binding.commandId,
        commandTitle: binding.label,
        category: binding.category,
        keybinding: effectiveKeybinding ? keymap.formatKeybinding(effectiveKeybinding) : "",
        when: effectiveWhen || "",
        source: binding.customKeybinding ? "user" : "default",
        isDefault: !binding.customKeybinding,
        isUserDefined: !!binding.customKeybinding,
        hasConflict: conflictsWith.length > 0,
        conflictsWith,
        binding,
      };
    });
  });

  // Filter and sort items
  const filteredAndSortedItems = createMemo(() => {
    let items = tableItems();
    const query = searchQuery().toLowerCase();
    const filter = filterSource();
    const byKeybinding = searchByKeybinding();

    // Filter by search query
    if (query) {
      items = items.filter((item) => {
        if (byKeybinding) {
          return item.keybinding.toLowerCase().includes(query);
        } else {
          return (
            item.commandTitle.toLowerCase().includes(query) ||
            item.command.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
          );
        }
      });
    }

    // Filter by source
    if (filter !== "all") {
      items = items.filter((item) => {
        if (filter === "user") return item.isUserDefined;
        if (filter === "default") return item.isDefault;
        if (filter === "extension") return item.source === "extension";
        return true;
      });
    }

    // Sort
    const field = sortField();
    const order = sortOrder();

    items = [...items].sort((a, b) => {
      let comparison = 0;

      switch (field) {
        case "command":
          comparison = a.commandTitle.localeCompare(b.commandTitle);
          break;
        case "keybinding":
          comparison = a.keybinding.localeCompare(b.keybinding);
          break;
        case "when":
          comparison = a.when.localeCompare(b.when);
          break;
        case "source":
          comparison = a.source.localeCompare(b.source);
          break;
      }

      return order === "asc" ? comparison : -comparison;
    });

    return items;
  });

  // Handle column header click for sorting
  const handleSort = (field: KeybindingSortField) => {
    if (sortField() === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Get sort indicator
  const getSortIndicator = (field: KeybindingSortField) => {
    if (sortField() !== field) return null;
    return sortOrder() === "asc" ? "\u25B2" : "\u25BC";
  };

  // Handle row double-click to edit
  const handleRowDoubleClick = (item: KeybindingTableItem) => {
    setEditingItem(item);
    setEditWhenClause(item.when);
    setRecordedKeys([]);
    setIsRecording(false);
    setEditConflicts([]);
    setEditModalOpen(true);
  };

  // Handle row click for selection
  const handleRowClick = (item: KeybindingTableItem) => {
    setSelectedItemId(item.id);
  };

  // Start recording keys
  const startRecording = () => {
    setIsRecording(true);
    setRecordedKeys([]);
    setEditConflicts([]);
  };

  // Stop recording keys
  const stopRecording = () => {
    setIsRecording(false);
    checkForConflicts();
  };

  // Check for conflicts with current recorded keys
  const checkForConflicts = () => {
    const keys = recordedKeys();
    if (keys.length === 0) {
      setEditConflicts([]);
      return;
    }

    const keyStr = keys.map(formatRecordedKey).join(" ");
    const editItem = editingItem();
    const items = tableItems();

    const conflicts = items
      .filter(
        (item) =>
          item.id !== editItem?.id &&
          item.keybinding.toLowerCase() === keyStr.toLowerCase()
      )
      .map((item) => item.commandTitle);

    setEditConflicts(conflicts);
  };

  // Handle key recording
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isRecording()) return;

    // Ignore modifier-only keys
    if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const recordedKey: RecordedKey = {
      code: event.code,
      key: event.key,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      timestamp: Date.now(),
    };

    setRecordedKeys((prev) => {
      // Limit to 2 keys for chord sequences
      if (prev.length >= 2) {
        return [recordedKey];
      }
      return [...prev, recordedKey];
    });

    // Auto-stop after a short delay if chord is complete
    setTimeout(() => {
      checkForConflicts();
    }, 100);
  };

  // Save edited keybinding
  const saveEdit = () => {
    const item = editingItem();
    if (!item) return;

    const keys = recordedKeys();

    if (keys.length > 0) {
      // Convert RecordedKey to Keystroke format
      const keystrokes: Keystroke[] = keys.map((key) => ({
        key: key.key,
        modifiers: {
          ctrl: key.ctrlKey,
          alt: key.altKey,
          shift: key.shiftKey,
          meta: key.metaKey,
        },
      }));

      const newKeybinding: Keybinding = { keystrokes };
      keymap.setCustomBinding(item.command, newKeybinding);
    }

    // Save when clause if changed
    const newWhen = editWhenClause().trim();
    if (newWhen !== item.when) {
      keymap.setCustomWhen(item.command, newWhen || null);
    }

    closeEditModal();
  };

  // Reset keybinding to default
  const resetToDefault = () => {
    const item = editingItem();
    if (!item) return;

    keymap.resetToDefault(item.command);
    closeEditModal();
  };

  // Remove keybinding
  const removeKeybinding = () => {
    const item = editingItem();
    if (!item) return;

    keymap.setCustomBinding(item.command, null);
    closeEditModal();
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingItem(null);
    setIsRecording(false);
    setRecordedKeys([]);
    setEditWhenClause("");
    setEditConflicts([]);
  };

  // Add keybinding to selected item
  const addKeybinding = () => {
    const selected = selectedItemId();
    if (!selected) return;

    const item = tableItems().find((i) => i.id === selected);
    if (item) {
      handleRowDoubleClick(item);
    }
  };

  // Remove keybinding from selected item
  const removeSelectedKeybinding = () => {
    const selected = selectedItemId();
    if (!selected) return;

    keymap.setCustomBinding(selected, null);
  };

  // Reset selected to default
  const resetSelectedToDefault = () => {
    const selected = selectedItemId();
    if (!selected) return;

    keymap.resetToDefault(selected);
  };

  // Keyboard event listener for recording
  onMount(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, true);
    });
  });

  // Get source badge style
  const getSourceBadgeStyle = (source: KeybindingSource) => {
    switch (source) {
      case "user":
        return { ...styles.sourceBadge, ...styles.sourceBadgeUser };
      case "extension":
        return { ...styles.sourceBadge, ...styles.sourceBadgeExtension };
      default:
        return { ...styles.sourceBadge, ...styles.sourceBadgeDefault };
    }
  };

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        {/* Search */}
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder={
              searchByKeybinding()
                ? "Search by keybinding..."
                : "Search commands..."
            }
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            style={styles.searchInput}
          />
          <span style={styles.searchIcon}>{"\uD83D\uDD0D"}</span>
        </div>

        {/* Search toggle */}
        <button
          style={{
            ...styles.filterButton,
            ...(searchByKeybinding() ? styles.filterButtonActive : {}),
          }}
          onClick={() => setSearchByKeybinding((prev) => !prev)}
          title="Toggle search by keybinding"
        >
          {"\u2328"}
        </button>

        {/* Filters */}
        <div style={styles.filterContainer}>
          <For each={["all", "user", "default", "extension"] as FilterSource[]}>
            {(filter) => (
              <button
                style={{
                  ...styles.filterButton,
                  ...(filterSource() === filter ? styles.filterButtonActive : {}),
                }}
                onClick={() => setFilterSource(filter)}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            )}
          </For>
        </div>

        {/* Action buttons */}
        <div style={styles.actionButtons}>
          <button
            style={{ ...styles.actionButton, ...styles.primaryButton }}
            onClick={addKeybinding}
            disabled={!selectedItemId()}
            title="Add/Edit Keybinding"
          >
            + Add
          </button>
          <button
            style={styles.actionButton}
            onClick={removeSelectedKeybinding}
            disabled={!selectedItemId()}
            title="Remove Keybinding"
          >
            - Remove
          </button>
          <button
            style={styles.actionButton}
            onClick={resetSelectedToDefault}
            disabled={!selectedItemId()}
            title="Reset to Default"
          >
            {"\u21BA"} Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        <Show
          when={filteredAndSortedItems().length > 0}
          fallback={
            <div style={styles.emptyState}>
              <div style={styles.emptyStateIcon}>{"\u2328"}</div>
              <div>No keybindings found</div>
              <div style={{ "font-size": "12px", "margin-top": "4px" }}>
                Try adjusting your search or filters
              </div>
            </div>
          }
        >
          <table style={styles.table}>
            <thead style={styles.tableHeader}>
              <tr>
                <th
                  style={{ ...styles.th, ...styles.thCommand }}
                  onClick={() => handleSort("command")}
                >
                  Command
                  <span style={styles.sortIndicator}>
                    {getSortIndicator("command")}
                  </span>
                </th>
                <th
                  style={{ ...styles.th, ...styles.thKeybinding }}
                  onClick={() => handleSort("keybinding")}
                >
                  Keybinding
                  <span style={styles.sortIndicator}>
                    {getSortIndicator("keybinding")}
                  </span>
                </th>
                <th
                  style={{ ...styles.th, ...styles.thWhen }}
                  onClick={() => handleSort("when")}
                >
                  When
                  <span style={styles.sortIndicator}>
                    {getSortIndicator("when")}
                  </span>
                </th>
                <th
                  style={{ ...styles.th, ...styles.thSource }}
                  onClick={() => handleSort("source")}
                >
                  Source
                  <span style={styles.sortIndicator}>
                    {getSortIndicator("source")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={filteredAndSortedItems()}>
                {(item) => (
                  <tr
                    style={{
                      ...styles.tr,
                      ...(hoveredItemId() === item.id ? styles.trHover : {}),
                      ...(selectedItemId() === item.id ? styles.trSelected : {}),
                    }}
                    onClick={() => handleRowClick(item)}
                    onDblClick={() => handleRowDoubleClick(item)}
                    onMouseEnter={() => setHoveredItemId(item.id)}
                    onMouseLeave={() => setHoveredItemId(null)}
                  >
                    <td style={styles.td}>
                      <div style={styles.commandCell}>
                        <span style={styles.commandTitle}>
                          {item.category}: {item.commandTitle}
                        </span>
                        <span style={styles.commandId}>{item.command}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.keybindingCell}>
                        <Show when={item.keybinding}>
                          <span style={styles.keybindingBadge}>
                            {item.keybinding}
                          </span>
                        </Show>
                        <Show when={item.hasConflict}>
                          <span
                            style={styles.conflictIndicator}
                            title={`Conflicts with: ${item.conflictsWith.join(", ")}`}
                          >
                            {"\u26A0"}
                          </span>
                        </Show>
                      </div>
                    </td>
                    <td style={{ ...styles.td, ...styles.whenCell }}>
                      {item.when || "-"}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.sourceCell}>
                        <span style={getSourceBadgeStyle(item.source)}>
                          {item.source}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>

      {/* Status Bar */}
      <div style={styles.statusBar}>
        <span>
          {filteredAndSortedItems().length} of {tableItems().length} keybindings
        </span>
        <span>
          {conflictsMap().size > 0 && (
            <span style={{ color: "var(--vscode-errorForeground, var(--cortex-error))" }}>
              {"\u26A0"} {conflictsMap().size} conflict(s) detected
            </span>
          )}
        </span>
      </div>

      {/* Edit Modal */}
      <Show when={editModalOpen()}>
        <div style={styles.modalOverlay} onClick={closeEditModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>
              Edit Keybinding: {editingItem()?.commandTitle}
            </div>

            {/* Keybinding Field */}
            <div style={styles.modalField}>
              <label style={styles.modalLabel}>Keybinding</label>
              <div
                style={{
                  ...styles.recordButton,
                  ...(isRecording() ? styles.recordButtonRecording : {}),
                }}
                onClick={() => (isRecording() ? stopRecording() : startRecording())}
                tabIndex={0}
              >
                <Show
                  when={recordedKeys().length > 0}
                  fallback={
                    <span>
                      {isRecording()
                        ? "Press keys... (click to stop)"
                        : "Click to record keys"}
                    </span>
                  }
                >
                  <div style={styles.recordedKeys}>
                    <For each={recordedKeys()}>
                      {(key, index) => (
                        <>
                          <span style={styles.recordedKey}>
                            {formatRecordedKey(key)}
                          </span>
                          <Show when={index() < recordedKeys().length - 1}>
                            <span style={{ opacity: 0.5 }}>{"\u2192"}</span>
                          </Show>
                        </>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={isRecording()}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      "border-radius": "var(--cortex-radius-full)",
                      "background-color": "var(--vscode-errorForeground, var(--cortex-error))",
                      animation: "pulse 1s infinite",
                    }}
                  />
                </Show>
              </div>

              {/* Current keybinding */}
              <Show when={editingItem()?.keybinding && recordedKeys().length === 0}>
                <div
                  style={{
                    "margin-top": "4px",
                    "font-size": "11px",
                    opacity: "0.7",
                  }}
                >
                  Current: {editingItem()?.keybinding}
                </div>
              </Show>
            </div>

            {/* When Clause Field */}
            <div style={styles.modalField}>
              <label style={styles.modalLabel}>When Clause (optional)</label>
              <input
                type="text"
                value={editWhenClause()}
                onInput={(e) => setEditWhenClause(e.currentTarget.value)}
                placeholder="e.g., editorTextFocus && !suggestWidgetVisible"
                style={styles.modalInput}
              />
              <div
                style={{
                  "margin-top": "4px",
                  "font-size": "11px",
                  opacity: "0.7",
                }}
              >
                Conditions when this keybinding is active
              </div>
            </div>

            {/* Conflict Warning */}
            <Show when={editConflicts().length > 0}>
              <div style={styles.conflictWarning}>
                <span>{"\u26A0"}</span>
                <span>
                  Conflicts with: {editConflicts().join(", ")}
                </span>
              </div>
            </Show>

            {/* Actions */}
            <div style={styles.modalActions}>
              <button
                style={{ ...styles.actionButton, ...styles.dangerButton }}
                onClick={removeKeybinding}
              >
                Remove
              </button>
              <button style={styles.actionButton} onClick={resetToDefault}>
                Reset to Default
              </button>
              <button style={styles.actionButton} onClick={closeEditModal}>
                Cancel
              </button>
              <button
                style={{ ...styles.actionButton, ...styles.primaryButton }}
                onClick={saveEdit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default KeybindingsEditor;

