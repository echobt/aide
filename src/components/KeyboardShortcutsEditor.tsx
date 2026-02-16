/**
 * Keyboard Shortcuts Editor
 * 
 * Full-screen modal showing all registered keyboard shortcuts with:
 * - Search/filter functionality
 * - Categorized shortcuts (Editor, Navigation, View, Debug, etc.)
 * - Styled keybindings like VSCode
 * - Integration with CommandContext
 */

import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { useCommands, type Command } from "@/context/CommandContext";
import { Icon } from "./ui/Icon";
import { Input, Text, EmptyState, IconButton } from "@/components/ui";

const CATEGORY_ORDER = [
  "General",
  "Navigation",
  "Editor",
  "Search",
  "View",
  "Debug",
  "Git",
  "Terminal",
  "Extension",
  "Other",
];

const CATEGORY_ICONS: Record<string, string> = {
  General: "grid",
  Navigation: "compass",
  Editor: "code",
  Search: "search",
  View: "layout",
  Debug: "bug",
  Git: "git-branch",
  Terminal: "terminal",
  Extension: "puzzle",
  Other: "dots-horizontal",
};

interface KeyCapProps {
  keys: string;
}

function KeyCap(props: KeyCapProps) {
  const parts = () => props.keys.split("+").map(k => k.trim());
  
  return (
    <div class="flex items-center gap-1">
      <For each={parts()}>
        {(key, index) => (
          <>
            <kbd
              class="inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono rounded"
              style={{
                background: "var(--jb-surface-active)",
                border: "1px solid var(--jb-border-default)",
                color: "var(--jb-text-body-color)",
                "min-width": "24px",
                "box-shadow": "0 1px 2px rgba(0, 0, 0, 0.2)",
              }}
            >
              {formatKey(key)}
            </kbd>
            <Show when={index() < parts().length - 1}>
              <span style={{ color: "var(--jb-text-muted-color)" }}>+</span>
            </Show>
          </>
        )}
      </For>
    </div>
  );
}

function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    "Ctrl": "Ctrl",
    "Control": "Ctrl",
    "Shift": "⇧",
    "Alt": "Alt",
    "Meta": "⌘",
    "Cmd": "⌘",
    "Enter": "↵",
    "Return": "↵",
    "Escape": "Esc",
    "Tab": "⇥",
    "Space": "␣",
    "Backspace": "⌫",
    "Delete": "Del",
    "ArrowUp": "↑",
    "ArrowDown": "↓",
    "ArrowLeft": "←",
    "ArrowRight": "→",
    "Left": "←",
    "Right": "→",
    "Up": "↑",
    "Down": "↓",
  };
  return keyMap[key] || key;
}

interface ShortcutRowProps {
  command: Command;
  isAlternate: boolean;
}

function ShortcutRow(props: ShortcutRowProps) {
  const { executeCommand } = useCommands();
  
  const handleExecute = () => {
    executeCommand(props.command.id);
  };
  
  return (
    <div
      class="flex items-center gap-4 px-4 py-2.5 hover:bg-white/5 cursor-pointer transition-colors group"
      style={{
        background: props.isAlternate ? "rgba(255, 255, 255, 0.02)" : "transparent",
      }}
      onClick={handleExecute}
    >
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <Text variant="body" truncate>
            {props.command.label}
          </Text>
          <Show when={props.command.isExtension}>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: "var(--jb-border-focus)",
                color: "white",
              }}
            >
              Extension
            </span>
          </Show>
        </div>
        <Text variant="muted" size="sm" truncate style={{ "margin-top": "2px" }}>
          {props.command.id}
        </Text>
      </div>
      <div class="flex items-center gap-3">
        <Show when={props.command.shortcut}>
          <KeyCap keys={props.command.shortcut!} />
        </Show>
        <Show when={!props.command.shortcut}>
          <span
            class="text-xs italic"
            style={{ color: "var(--jb-text-muted-color)" }}
          >
            No shortcut
          </span>
        </Show>
        <IconButton
          icon="play"
          size="sm"
          variant="ghost"
          title="Run command"
          class="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            handleExecute();
          }}
        />
      </div>
    </div>
  );
}

interface CategorySectionProps {
  category: string;
  commands: Command[];
  isExpanded: boolean;
  onToggle: () => void;
}

function CategorySection(props: CategorySectionProps) {
  const withShortcuts = () => props.commands.filter(c => c.shortcut).length;
  
  return (
    <div class="border-b" style={{ "border-color": "var(--jb-border-default)" }}>
      <button
        class="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
        onClick={props.onToggle}
      >
        <Icon
          name={props.isExpanded ? "chevron-down" : "chevron-right"}
          class="w-4 h-4"
          style={{ color: "var(--jb-text-muted-color)" }}
        />
        <Icon
          name={CATEGORY_ICONS[props.category] || "folder"}
          class="w-4 h-4"
          style={{ color: "var(--jb-border-focus)" }}
        />
        <span
          class="flex-1 text-left text-sm font-medium"
          style={{ color: "var(--jb-text-body-color)" }}
        >
          {props.category}
        </span>
        <span
          class="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: "var(--jb-surface-active)",
            color: "var(--jb-text-muted-color)",
          }}
        >
          {props.commands.length} commands • {withShortcuts()} with shortcuts
        </span>
      </button>
      <Show when={props.isExpanded}>
        <div class="pb-2">
          <For each={props.commands}>
            {(cmd, index) => (
              <ShortcutRow command={cmd} isAlternate={index() % 2 === 1} />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export function KeyboardShortcutsEditor() {
  const { commands } = useCommands();
  const [isOpen, setIsOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedCategories, setExpandedCategories] = createSignal<Set<string>>(
    new Set(["General", "Navigation", "Editor", "Search"])
  );
  const [filterMode, setFilterMode] = createSignal<"all" | "with-shortcut" | "without-shortcut">("all");
  
  let inputRef: HTMLInputElement | undefined;
  
  const filteredCommands = createMemo(() => {
    let cmds = commands();
    const query = searchQuery().toLowerCase().trim();
    
    if (filterMode() === "with-shortcut") {
      cmds = cmds.filter(c => c.shortcut);
    } else if (filterMode() === "without-shortcut") {
      cmds = cmds.filter(c => !c.shortcut);
    }
    
    if (query) {
      cmds = cmds.filter(c =>
        c.label.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query) ||
        (c.shortcut && c.shortcut.toLowerCase().includes(query)) ||
        (c.category && c.category.toLowerCase().includes(query))
      );
    }
    
    return cmds;
  });
  
  const groupedCommands = createMemo(() => {
    const groups: Record<string, Command[]> = {};
    
    for (const cmd of filteredCommands()) {
      const category = cmd.category || "Other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(cmd);
    }
    
    for (const category of Object.keys(groups)) {
      groups[category].sort((a, b) => {
        if (a.shortcut && !b.shortcut) return -1;
        if (!a.shortcut && b.shortcut) return 1;
        return a.label.localeCompare(b.label);
      });
    }
    
    return groups;
  });
  
  const sortedCategories = createMemo(() => {
    const categories = Object.keys(groupedCommands());
    return categories.sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a);
      const bIndex = CATEGORY_ORDER.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  });
  
  const totalCommands = () => commands().length;
  const totalWithShortcuts = () => commands().filter(c => c.shortcut).length;
  
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };
  
  const expandAll = () => {
    setExpandedCategories(new Set<string>(sortedCategories()));
  };
  
  const collapseAll = () => {
    setExpandedCategories(new Set<string>());
  };
  
  const handleOpen = () => {
    setIsOpen(true);
    setSearchQuery("");
    setTimeout(() => inputRef?.focus(), 50);
  };
  
  const handleClose = () => {
    setIsOpen(false);
  };
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isOpen()) {
      e.preventDefault();
      handleClose();
    }
  };
  
  onMount(() => {
    const handleShowShortcuts = () => handleOpen();
    window.addEventListener("keyboard-shortcuts:show", handleShowShortcuts);
    window.addEventListener("keydown", handleKeyDown);
    
    onCleanup(() => {
      window.removeEventListener("keyboard-shortcuts:show", handleShowShortcuts);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });
  
  return (
    <Show when={isOpen()}>
      <Portal>
        <div
          class="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.6)" }}
          onClick={handleClose}
        >
          <div
            class="w-full max-w-4xl h-[80vh] mx-4 flex flex-col overflow-hidden"
            style={{
              background: "var(--jb-canvas)",
              border: "1px solid var(--jb-border-default)",
              "border-radius": "var(--cortex-radius-lg)",
              "box-shadow": "0 16px 48px rgba(0, 0, 0, 0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              class="flex items-center justify-between px-6 py-4 border-b"
              style={{ "border-color": "var(--jb-border-default)" }}
            >
              <div class="flex items-center gap-3">
                <Icon
                  name="keyboard"
                  class="w-5 h-5"
                  style={{ color: "var(--jb-border-focus)" }}
                />
                <Text variant="header" size="lg">
                  Keyboard Shortcuts
                </Text>
                <span
                  class="text-xs px-2 py-0.5 rounded"
                  style={{
                    background: "var(--jb-surface-active)",
                    color: "var(--jb-text-muted-color)",
                  }}
                >
                  {totalCommands()} commands • {totalWithShortcuts()} with shortcuts
                </span>
              </div>
              <IconButton
                icon="x"
                size="sm"
                variant="ghost"
                title="Close (Esc)"
                onClick={handleClose}
              />
            </div>
            
            {/* Toolbar */}
            <div
              class="flex items-center gap-4 px-6 py-3 border-b"
              style={{ "border-color": "var(--jb-border-default)" }}
            >
              <div class="flex-1">
                <Input
                  ref={inputRef}
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  placeholder="Search commands, shortcuts, or categories..."
                  icon="search"
                />
              </div>
              <div class="flex items-center gap-2">
                <select
                  class="px-3 py-1.5 text-sm rounded"
                  style={{
                    background: "var(--jb-surface-active)",
                    border: "1px solid var(--jb-border-default)",
                    color: "var(--jb-text-body-color)",
                  }}
                  value={filterMode()}
                  onChange={(e) => setFilterMode(e.currentTarget.value as typeof filterMode extends () => infer T ? T : never)}
                >
                  <option value="all">All Commands</option>
                  <option value="with-shortcut">With Shortcut</option>
                  <option value="without-shortcut">Without Shortcut</option>
                </select>
                <IconButton
                  icon="chevrons-down"
                  size="sm"
                  variant="ghost"
                  title="Expand All"
                  onClick={expandAll}
                />
                <IconButton
                  icon="chevrons-up"
                  size="sm"
                  variant="ghost"
                  title="Collapse All"
                  onClick={collapseAll}
                />
              </div>
            </div>
            
            {/* Content */}
            <div class="flex-1 overflow-y-auto">
              <Show
                when={sortedCategories().length > 0}
                fallback={
                  <div class="flex items-center justify-center h-full">
                    <EmptyState
                      icon="search"
                      title="No commands found"
                      description={`No commands match "${searchQuery()}"`}
                    />
                  </div>
                }
              >
                <For each={sortedCategories()}>
                  {(category) => (
                    <CategorySection
                      category={category}
                      commands={groupedCommands()[category]}
                      isExpanded={expandedCategories().has(category)}
                      onToggle={() => toggleCategory(category)}
                    />
                  )}
                </For>
              </Show>
            </div>
            
            {/* Footer */}
            <div
              class="flex items-center justify-between px-6 py-3 border-t"
              style={{ "border-color": "var(--jb-border-default)" }}
            >
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <KeyCap keys="Escape" />
                  <Text variant="muted" size="sm">Close</Text>
                </div>
                <div class="flex items-center gap-2">
                  <KeyCap keys="Ctrl+K" />
                  <Text variant="muted" size="sm">then</Text>
                  <KeyCap keys="Ctrl+S" />
                  <Text variant="muted" size="sm">Open Shortcuts</Text>
                </div>
              </div>
              <Text variant="muted" size="sm">
                Click a command to execute it
              </Text>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

export default KeyboardShortcutsEditor;
