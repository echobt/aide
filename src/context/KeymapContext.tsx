import { createContext, useContext, createSignal, createMemo, ParentProps, onMount, onCleanup, createEffect } from "solid-js";
import { createStore } from "solid-js/store";

// ============================================================================
// Context Keys - VS Code-style conditional context for keybindings
// ============================================================================

/** Context keys that can be used in "when" clauses for conditional keybindings */
export interface ContextKeys {
  // Editor focus states
  editorTextFocus: boolean;
  editorHasSelection: boolean;
  editorHasMultipleSelections: boolean;
  editorReadonly: boolean;
  editorLangId: string;
  
  // Terminal states
  terminalFocus: boolean;
  terminalIsOpen: boolean;
  
  // UI focus states
  searchInputFocus: boolean;
  inputFocus: boolean;
  listFocus: boolean;
  treeViewFocus: boolean;
  
  // Panel visibility
  sidebarVisible: boolean;
  panelVisible: boolean;
  auxiliaryBarVisible: boolean;
  
  // Modal states
  inQuickOpen: boolean;
  inCommandPalette: boolean;
  suggestWidgetVisible: boolean;
  
  // Workspace states
  workspaceFolderCount: number;
  gitRepoOpen: boolean;
  
  // Debug states
  debuggingActive: boolean;
  inDebugMode: boolean;
  debugState: string;
  
  // Editor modes
  inSnippetMode: boolean;
  vimMode: string;
  
  // Recording state
  isRecordingKeybinding: boolean;
  
  // Zen mode
  inZenMode: boolean;
  
  // Custom context keys (extensible)
  [key: string]: boolean | string | number;
}

/** Default context key values */
const DEFAULT_CONTEXT_KEYS: ContextKeys = {
  editorTextFocus: false,
  editorHasSelection: false,
  editorHasMultipleSelections: false,
  editorReadonly: false,
  editorLangId: "",
  terminalFocus: false,
  terminalIsOpen: false,
  searchInputFocus: false,
  inputFocus: false,
  listFocus: false,
  treeViewFocus: false,
  sidebarVisible: true,
  panelVisible: false,
  auxiliaryBarVisible: false,
  inQuickOpen: false,
  inCommandPalette: false,
  suggestWidgetVisible: false,
  workspaceFolderCount: 0,
  gitRepoOpen: false,
  debuggingActive: false,
  inDebugMode: false,
  debugState: "inactive",
  inSnippetMode: false,
  vimMode: "normal",
  isRecordingKeybinding: false,
  inZenMode: false,
};

// ============================================================================
// When Clause Evaluation
// ============================================================================

/**
 * Evaluate a single token in a when clause expression.
 * Supports:
 * - Simple key lookup: "editorTextFocus"
 * - Negation: "!editorTextFocus"
 * - String comparison: "editorLangId == 'typescript'"
 * - Numeric comparison: "workspaceFolderCount > 0"
 */
function evaluateToken(token: string, contextKeys: ContextKeys): boolean {
  const trimmed = token.trim();
  
  // Handle negation
  if (trimmed.startsWith("!")) {
    const key = trimmed.slice(1).trim();
    const value = contextKeys[key];
    return !value;
  }
  
  // Handle equality comparison (==, !=)
  if (trimmed.includes("==") || trimmed.includes("!=")) {
    const isNotEqual = trimmed.includes("!=");
    const [keyPart, valuePart] = trimmed.split(isNotEqual ? "!=" : "==").map(s => s.trim());
    const actualValue = contextKeys[keyPart];
    
    // Remove quotes from value part if present
    let expectedValue: string | number | boolean = valuePart;
    if ((valuePart.startsWith("'") && valuePart.endsWith("'")) ||
        (valuePart.startsWith('"') && valuePart.endsWith('"'))) {
      expectedValue = valuePart.slice(1, -1);
    } else if (valuePart === "true") {
      expectedValue = true;
    } else if (valuePart === "false") {
      expectedValue = false;
    } else if (!isNaN(Number(valuePart))) {
      expectedValue = Number(valuePart);
    }
    
    const result = actualValue === expectedValue;
    return isNotEqual ? !result : result;
  }
  
  // Handle numeric comparisons (>, <, >=, <=)
  const numericMatch = trimmed.match(/^(\w+)\s*(>=|<=|>|<)\s*(\d+)$/);
  if (numericMatch) {
    const [, key, operator, valueStr] = numericMatch;
    const actualValue = Number(contextKeys[key]) || 0;
    const compareValue = Number(valueStr);
    
    switch (operator) {
      case ">": return actualValue > compareValue;
      case "<": return actualValue < compareValue;
      case ">=": return actualValue >= compareValue;
      case "<=": return actualValue <= compareValue;
    }
  }
  
  // Handle "in" operator: "resourceScheme in 'file,untitled'"
  if (trimmed.includes(" in ")) {
    const [keyPart, listPart] = trimmed.split(" in ").map(s => s.trim());
    const actualValue = String(contextKeys[keyPart] || "");
    const list = listPart.replace(/['"]/g, "").split(",").map(s => s.trim());
    return list.includes(actualValue);
  }
  
  // Simple boolean key lookup
  const value = contextKeys[trimmed];
  return !!value;
}

/**
 * Evaluate a when clause expression.
 * Supports: key, !key, key && key, key || key, and parentheses for grouping.
 * 
 * Examples:
 * - "editorTextFocus"
 * - "!terminalFocus"
 * - "editorTextFocus && editorHasSelection"
 * - "terminalFocus || searchInputFocus"
 * - "editorTextFocus && !suggestWidgetVisible"
 * - "editorLangId == 'typescript'"
 */
function evaluateWhenClause(when: string | undefined, contextKeys: ContextKeys): boolean {
  if (!when || when.trim() === "") {
    return true; // No condition means always enabled
  }
  
  // Handle parentheses by recursively evaluating inner expressions
  // Simple implementation: doesn't handle nested parentheses
  let expression = when.trim();
  
  // Replace parenthesized expressions first
  while (expression.includes("(")) {
    expression = expression.replace(/\(([^()]+)\)/g, (_, inner) => {
      return evaluateWhenClause(inner, contextKeys) ? "true" : "false";
    });
  }
  
  // Handle OR (||) - lowest precedence, so we split on it first
  if (expression.includes("||")) {
    const parts = expression.split("||").map(s => s.trim());
    return parts.some(part => evaluateWhenClause(part, contextKeys));
  }
  
  // Handle AND (&&) - higher precedence than OR
  if (expression.includes("&&")) {
    const parts = expression.split("&&").map(s => s.trim());
    return parts.every(part => evaluateWhenClause(part, contextKeys));
  }
  
  // Single token
  return evaluateToken(expression, contextKeys);
}

/** Modifier keys for keybindings */
export interface KeyModifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/** Represents a single keystroke in a keybinding */
export interface Keystroke {
  key: string;
  modifiers: KeyModifiers;
}

/** A complete keybinding (can be a chord sequence) */
export interface Keybinding {
  keystrokes: Keystroke[];
}

/** A command with its keybinding */
export interface CommandBinding {
  commandId: string;
  label: string;
  category: string;
  defaultKeybinding: Keybinding | null;
  customKeybinding: Keybinding | null;
  /** VS Code-style "when" clause for conditional keybinding activation */
  when?: string;
  /** Custom when clause override (set by user) */
  customWhen?: string;
  /** @deprecated Use "when" instead */
  context?: string;
}

/** Conflict information when two commands share the same keybinding */
export interface KeybindingConflict {
  keybinding: Keybinding;
  commands: string[];
}

/** State for the keymap editor */
export interface KeymapState {
  bindings: CommandBinding[];
  customBindings: Record<string, Keybinding | null>;
  conflicts: KeybindingConflict[];
  isRecording: boolean;
  recordingCommandId: string | null;
  recordedKeystrokes: Keystroke[];
}

/** Chord mode state for two-part keybindings */
export interface ChordState {
  active: boolean;
  pendingKeystroke: Keystroke | null;
  indicator: string;
}

/** Context value interface */
export interface KeymapContextValue {
  state: KeymapState;
  bindings: () => CommandBinding[];
  customBindings: () => Record<string, Keybinding | null>;
  conflicts: () => KeybindingConflict[];
  isRecording: () => boolean;
  recordingCommandId: () => string | null;
  recordedKeystrokes: () => Keystroke[];
  
  // Chord mode
  chordState: () => ChordState;
  isChordModeActive: () => boolean;
  chordIndicator: () => string;
  cancelChordMode: () => void;
  
  // Context keys for "when" clauses
  contextKeys: ContextKeys;
  setContextKey: <K extends keyof ContextKeys>(key: K, value: ContextKeys[K]) => void;
  setContextKeys: (updates: Partial<ContextKeys>) => void;
  evaluateWhen: (when: string | undefined) => boolean;
  
  // Actions
  setCustomBinding: (commandId: string, keybinding: Keybinding | null) => void;
  setCustomWhen: (commandId: string, when: string | null) => void;
  removeCustomBinding: (commandId: string) => void;
  resetToDefault: (commandId: string) => void;
  resetAllToDefault: () => void;
  startRecording: (commandId: string) => void;
  stopRecording: () => void;
  clearRecording: () => void;
  addRecordedKeystroke: (keystroke: Keystroke) => void;
  saveRecordedBinding: () => void;
  getEffectiveBinding: (commandId: string) => Keybinding | null;
  getEffectiveWhen: (commandId: string) => string | undefined;
  getBindingForKeystroke: (keybinding: Keybinding) => CommandBinding[];
  matchesKeybinding: (binding: CommandBinding, keystroke: Keystroke | Keystroke[]) => boolean;
  formatKeybinding: (keybinding: Keybinding | null) => string;
  parseKeybindingString: (str: string) => Keybinding | null;
  exportCustomBindings: () => string;
  importCustomBindings: (json: string) => boolean;
  
  // Chord handling for external keyboard event processing
  handleKeystrokeForChord: (keystroke: Keystroke) => { handled: boolean; commandId: string | null };
  getChordPrefixCommands: (keystroke: Keystroke) => CommandBinding[];
}

const STORAGE_KEY = "cortex_keybindings";
const WHEN_STORAGE_KEY = "cortex_keybinding_when_clauses";

/** Load custom when clauses from localStorage */
function loadCustomWhenClauses(): Record<string, string | null> {
  try {
    const stored = localStorage.getItem(WHEN_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[KeymapContext] Failed to load custom when clauses:", e);
  }
  return {};
}

/** Save custom when clauses to localStorage */
function saveCustomWhenClauses(whenClauses: Record<string, string | null>): void {
  try {
    localStorage.setItem(WHEN_STORAGE_KEY, JSON.stringify(whenClauses));
  } catch (e) {
    console.error("[KeymapContext] Failed to save custom when clauses:", e);
  }
}

/** Default keybindings for all commands */
const DEFAULT_BINDINGS: Omit<CommandBinding, "customKeybinding">[] = [
  // General
  {
    commandId: "command-palette",
    label: "Show Command Palette",
    category: "General",
    defaultKeybinding: { keystrokes: [{ key: "p", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "file-finder",
    label: "Go to File",
    category: "General",
    defaultKeybinding: { keystrokes: [{ key: "p", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "settings",
    label: "Open Settings",
    category: "General",
    defaultKeybinding: { keystrokes: [{ key: ",", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "new-session",
    label: "New Session",
    category: "General",
    defaultKeybinding: { keystrokes: [{ key: "n", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  // Search
  {
    commandId: "buffer-search",
    label: "Find in File",
    category: "Search",
    defaultKeybinding: { keystrokes: [{ key: "f", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "project-search",
    label: "Find in Project",
    category: "Search",
    defaultKeybinding: { keystrokes: [{ key: "f", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "replace-in-file",
    label: "Replace in File",
    category: "Search",
    defaultKeybinding: { keystrokes: [{ key: "h", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  // Navigation
  {
    commandId: "go-to-line",
    label: "Go to Line",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "g", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "go-to-definition",
    label: "Go to Definition",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "F12", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "go-to-references",
    label: "Go to References",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "F12", modifiers: { ctrl: false, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "go-back",
    label: "Go Back",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "-", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "go-forward",
    label: "Go Forward",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "-", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Edit
  {
    commandId: "undo",
    label: "Undo",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "z", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "redo",
    label: "Redo",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "z", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "cut",
    label: "Cut",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "x", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "copy",
    label: "Copy",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "c", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "paste",
    label: "Paste",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "v", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "select-all",
    label: "Select All",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "a", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "duplicate-selection",
    label: "Duplicate Selection",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "d", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "move-line-up",
    label: "Move Line Up",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "ArrowUp", modifiers: { ctrl: false, alt: true, shift: false, meta: false } }] },
    when: "editorTextFocus && !suggestWidgetVisible",
  },
  {
    commandId: "move-line-down",
    label: "Move Line Down",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "ArrowDown", modifiers: { ctrl: false, alt: true, shift: false, meta: false } }] },
    when: "editorTextFocus && !suggestWidgetVisible",
  },
  {
    commandId: "copy-line-up",
    label: "Copy Line Up",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "ArrowUp", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
  },
  {
    commandId: "copy-line-down",
    label: "Copy Line Down",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "ArrowDown", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
  },
  {
    commandId: "comment-line",
    label: "Toggle Line Comment",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "/", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  // Chord-based comment commands (Ctrl+K Ctrl+C / Ctrl+K Ctrl+U)
  {
    commandId: "add-line-comment",
    label: "Add Line Comment",
    category: "Edit",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "c", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "remove-line-comment",
    label: "Remove Line Comment",
    category: "Edit",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "u", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "save-without-formatting",
    label: "Save Without Formatting",
    category: "File",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "s", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "indent",
    label: "Indent Line",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "]", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "outdent",
    label: "Outdent Line",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "[", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  // Multi-Cursor
  {
    commandId: "add-cursor-above",
    label: "Add Cursor Above",
    category: "Multi-Cursor",
    defaultKeybinding: { keystrokes: [{ key: "ArrowUp", modifiers: { ctrl: true, alt: true, shift: false, meta: false } }] },
  },
  {
    commandId: "add-cursor-below",
    label: "Add Cursor Below",
    category: "Multi-Cursor",
    defaultKeybinding: { keystrokes: [{ key: "ArrowDown", modifiers: { ctrl: true, alt: true, shift: false, meta: false } }] },
  },
  {
    commandId: "select-all-occurrences",
    label: "Select All Occurrences",
    category: "Multi-Cursor",
    defaultKeybinding: { keystrokes: [{ key: "l", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "add-next-occurrence",
    label: "Add Selection to Next Find Match",
    category: "Multi-Cursor",
    defaultKeybinding: { keystrokes: [{ key: "d", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "add-cursors-to-line-ends",
    label: "Add Cursors to Line Ends",
    category: "Multi-Cursor",
    defaultKeybinding: { keystrokes: [{ key: "i", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
  },
  // Selection
  {
    commandId: "select-line",
    label: "Select Line",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "l", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "expand-selection",
    label: "Expand Selection",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "ArrowRight", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
  },
  {
    commandId: "shrink-selection",
    label: "Shrink Selection",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "ArrowLeft", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
  },
  // Editor Layout
  {
    commandId: "split-editor-right",
    label: "Split Editor Right",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [{ key: "\\", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "split-editor-down",
    label: "Split Editor Down",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "\\", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "close-editor",
    label: "Close Editor",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [{ key: "w", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "close-all-editors",
    label: "Close All Editors",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "w", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "pin-tab",
    label: "Pin Tab",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "Enter", modifiers: { ctrl: false, alt: false, shift: true, meta: false } },
    ] },
  },
  {
    commandId: "unpin-tab",
    label: "Unpin Tab",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "Enter", modifiers: { ctrl: true, alt: false, shift: true, meta: false } },
    ] },
  },
  {
    commandId: "focus-next-group",
    label: "Focus Next Editor Group",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "ArrowRight", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  {
    commandId: "focus-previous-group",
    label: "Focus Previous Editor Group",
    category: "Editor Layout",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "ArrowLeft", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  // View
  {
    commandId: "toggle-sidebar",
    label: "Toggle Sidebar",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "b", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "toggle-terminal",
    label: "Toggle Terminal",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "`", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "toggle-problems",
    label: "Toggle Problems Panel",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "m", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "zoom-in",
    label: "Zoom In",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "=", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "zoom-out",
    label: "Zoom Out",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "-", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  // File
  {
    commandId: "new-file",
    label: "New File",
    category: "File",
    defaultKeybinding: { keystrokes: [{ key: "n", modifiers: { ctrl: true, alt: true, shift: false, meta: false } }] },
  },
  {
    commandId: "save-file",
    label: "Save File",
    category: "File",
    defaultKeybinding: { keystrokes: [{ key: "s", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "save-all",
    label: "Save All",
    category: "File",
    defaultKeybinding: { keystrokes: [{ key: "s", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Tasks
  {
    commandId: "run-task",
    label: "Run Task...",
    category: "Tasks",
    defaultKeybinding: { keystrokes: [{ key: "t", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "run-build-task",
    label: "Run Build Task",
    category: "Tasks",
    defaultKeybinding: { keystrokes: [{ key: "b", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "run-test-task",
    label: "Run Test Task",
    category: "Tasks",
    defaultKeybinding: { keystrokes: [{ key: "y", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Debug
  {
    commandId: "start-debugging",
    label: "Start Debugging",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F5", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "stop-debugging",
    label: "Stop Debugging",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F5", modifiers: { ctrl: false, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "toggle-breakpoint",
    label: "Toggle Breakpoint",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F9", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "step-over",
    label: "Step Over",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F10", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
    when: "debuggingActive",
  },
  {
    commandId: "step-into",
    label: "Step Into",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F11", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "step-out",
    label: "Step Out",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F11", modifiers: { ctrl: false, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "continue",
    label: "Continue",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F5", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "jump-to-cursor",
    label: "Jump to Cursor (Set Next Statement)",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F10", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "debuggingActive && editorTextFocus",
  },
  {
    commandId: "step-into-targets",
    label: "Step Into Target...",
    category: "Debug",
    defaultKeybinding: null,
    when: "debuggingActive",
  },
  {
    commandId: "restart-frame",
    label: "Restart Frame",
    category: "Debug",
    defaultKeybinding: null,
    when: "debuggingActive",
  },
  // Transform
  {
    commandId: "transform-uppercase",
    label: "Transform to Uppercase",
    category: "Transform",
    defaultKeybinding: null,
  },
  {
    commandId: "transform-lowercase",
    label: "Transform to Lowercase",
    category: "Transform",
    defaultKeybinding: null,
  },
  {
    commandId: "transform-titlecase",
    label: "Transform to Title Case",
    category: "Transform",
    defaultKeybinding: null,
  },
  // Git
  {
    commandId: "git-commit",
    label: "Git: Commit",
    category: "Git",
    defaultKeybinding: null,
  },
  {
    commandId: "git-push",
    label: "Git: Push",
    category: "Git",
    defaultKeybinding: null,
  },
  {
    commandId: "git-pull",
    label: "Git: Pull",
    category: "Git",
    defaultKeybinding: null,
  },
  {
    commandId: "git-stage-all",
    label: "Git: Stage All Changes",
    category: "Git",
    defaultKeybinding: null,
  },
  // Layout commands
  {
    commandId: "toggle-panel",
    label: "Toggle Panel",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "j", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "focus-explorer",
    label: "Focus Explorer",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "e", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  {
    commandId: "focus-debug",
    label: "Focus Debug Panel",
    category: "View",
    defaultKeybinding: { keystrokes: [{ key: "d", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Tab Navigation
  {
    commandId: "next-tab",
    label: "Switch to Next Tab",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "Tab", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "prev-tab",
    label: "Switch to Previous Tab",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "Tab", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Project-wide Replace
  {
    commandId: "replace-in-files",
    label: "Replace in Files",
    category: "Search",
    defaultKeybinding: { keystrokes: [{ key: "h", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
  // Recent Projects (moved from Ctrl+Shift+E to Ctrl+Alt+R)
  {
    commandId: "recent-projects",
    label: "Open Recent Project",
    category: "File",
    defaultKeybinding: { keystrokes: [{ key: "r", modifiers: { ctrl: true, alt: true, shift: false, meta: false } }] },
  },
  // Join Lines (moved from Ctrl+J to Ctrl+Shift+J)
  {
    commandId: "join-lines",
    label: "Join Lines",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "j", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  // Transpose commands
  {
    commandId: "transpose-characters",
    label: "Transpose Characters",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "t", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  // In-place replace commands
  {
    commandId: "in-place-replace-up",
    label: "Replace with Previous Value",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: ",", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "in-place-replace-down",
    label: "Replace with Next Value",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: ".", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  // Delete word part commands
  {
    commandId: "delete-word-part-left",
    label: "Delete Word Part Left",
    category: "Edit",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  {
    commandId: "delete-word-part-right",
    label: "Delete Word Part Right",
    category: "Edit",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Linked editing
  {
    commandId: "toggle-linked-editing",
    label: "Toggle Linked Editing",
    category: "Edit",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Hover and suggestions
  {
    commandId: "show-hover",
    label: "Show Hover",
    category: "Edit",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "i", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
    when: "editorTextFocus",
  },
  {
    commandId: "trigger-suggest",
    label: "Trigger Suggest",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: " ", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "trigger-parameter-hints",
    label: "Trigger Parameter Hints",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: " ", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  // Smart select
  {
    commandId: "smart-select-expand",
    label: "Expand Selection (Smart)",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "ArrowRight", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "smart-select-shrink",
    label: "Shrink Selection (Smart)",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "ArrowLeft", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  // Quick fix and refactoring
  {
    commandId: "quick-fix",
    label: "Quick Fix",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: ".", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "refactor",
    label: "Refactor",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "r", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "source-action",
    label: "Source Action",
    category: "Edit",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Rename symbol
  {
    commandId: "rename-symbol",
    label: "Rename Symbol",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: "F2", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  // Go to type definition
  {
    commandId: "go-to-type-definition",
    label: "Go to Type Definition",
    category: "Navigation",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Find references
  {
    commandId: "find-all-references",
    label: "Find All References",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "F12", modifiers: { ctrl: false, alt: true, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  // Call hierarchy
  {
    commandId: "show-call-hierarchy",
    label: "Show Call Hierarchy",
    category: "Navigation",
    defaultKeybinding: { keystrokes: [{ key: "h", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  // Type hierarchy
  {
    commandId: "show-type-hierarchy",
    label: "Show Type Hierarchy",
    category: "Navigation",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Imports management
  {
    commandId: "organize-imports",
    label: "Organize Imports",
    category: "Source",
    defaultKeybinding: { keystrokes: [{ key: "o", modifiers: { ctrl: false, alt: true, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "sort-imports",
    label: "Sort Imports",
    category: "Source",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  {
    commandId: "remove-unused-imports",
    label: "Remove Unused Imports",
    category: "Source",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  {
    commandId: "add-missing-imports",
    label: "Add Missing Imports",
    category: "Source",
    defaultKeybinding: null,
    when: "editorTextFocus",
  },
  // Column selection mode
  {
    commandId: "toggle-column-selection",
    label: "Toggle Column Selection Mode",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "c", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  // VS Code-style editor actions
  {
    commandId: "editor.action.find",
    label: "Find",
    category: "Search",
    defaultKeybinding: { keystrokes: [{ key: "f", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "editor.action.replace",
    label: "Replace",
    category: "Search",
    defaultKeybinding: { keystrokes: [{ key: "h", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "editor.action.selectAllOccurrences",
    label: "Select All Occurrences of Find Match",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "l", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "editor.action.addSelectionToNextFindMatch",
    label: "Add Selection To Next Find Match",
    category: "Selection",
    defaultKeybinding: { keystrokes: [{ key: "d", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "editor.action.rename",
    label: "Rename Symbol",
    category: "Refactor",
    defaultKeybinding: { keystrokes: [{ key: "F2", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "editor.action.triggerParameterHints",
    label: "Trigger Parameter Hints",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: " ", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
    when: "editorTextFocus",
  },
  {
    commandId: "editor.action.quickFix",
    label: "Quick Fix",
    category: "Edit",
    defaultKeybinding: { keystrokes: [{ key: ".", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  // VS Code-style workbench actions
  {
    commandId: "workbench.action.openSettings",
    label: "Open Settings",
    category: "Preferences",
    defaultKeybinding: { keystrokes: [{ key: ",", modifiers: { ctrl: true, alt: false, shift: false, meta: false } }] },
  },
  {
    commandId: "workbench.action.openKeybindings",
    label: "Open Keyboard Shortcuts",
    category: "Preferences",
    defaultKeybinding: { keystrokes: [
      { key: "k", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
      { key: "s", modifiers: { ctrl: true, alt: false, shift: false, meta: false } },
    ] },
  },
  // Debug actions
  {
    commandId: "debug.toggleBreakpoint",
    label: "Toggle Breakpoint",
    category: "Debug",
    defaultKeybinding: { keystrokes: [{ key: "F9", modifiers: { ctrl: false, alt: false, shift: false, meta: false } }] },
    when: "editorTextFocus",
  },
  // Search actions
  {
    commandId: "search.action.openSearchEditor",
    label: "Open Search Editor",
    category: "Search",
    defaultKeybinding: { keystrokes: [{ key: "f", modifiers: { ctrl: true, alt: false, shift: true, meta: false } }] },
  },
];

const KeymapContext = createContext<KeymapContextValue>();

/** Load custom bindings from localStorage */
function loadCustomBindings(): Record<string, Keybinding | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[KeymapContext] Failed to load custom bindings:", e);
  }
  return {};
}

/** Save custom bindings to localStorage */
function saveCustomBindings(bindings: Record<string, Keybinding | null>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch (e) {
    console.error("[KeymapContext] Failed to save custom bindings:", e);
  }
}

/** Format a single keystroke for display */
function formatKeystroke(keystroke: Keystroke): string {
  const parts: string[] = [];
  
  if (keystroke.modifiers.ctrl) parts.push("Ctrl");
  if (keystroke.modifiers.alt) parts.push("Alt");
  if (keystroke.modifiers.shift) parts.push("Shift");
  if (keystroke.modifiers.meta) parts.push("Meta");
  
  // Format special keys
  let keyDisplay = keystroke.key;
  const keyMap: Record<string, string> = {
    "ArrowUp": "↑",
    "ArrowDown": "↓",
    "ArrowLeft": "←",
    "ArrowRight": "→",
    "Escape": "Esc",
    "Backspace": "⌫",
    "Delete": "Del",
    "Enter": "↵",
    "Tab": "⇥",
    " ": "Space",
  };
  
  if (keyMap[keystroke.key]) {
    keyDisplay = keyMap[keystroke.key];
  } else if (keystroke.key.length === 1) {
    keyDisplay = keystroke.key.toUpperCase();
  }
  
  parts.push(keyDisplay);
  return parts.join("+");
}

/** Format a complete keybinding for display */
function formatKeybindingFn(keybinding: Keybinding | null): string {
  if (!keybinding || keybinding.keystrokes.length === 0) {
    return "";
  }
  
  return keybinding.keystrokes.map(formatKeystroke).join(" ");
}

/** Compare two keystrokes for equality */
function keystrokesEqual(a: Keystroke, b: Keystroke): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    a.modifiers.ctrl === b.modifiers.ctrl &&
    a.modifiers.alt === b.modifiers.alt &&
    a.modifiers.shift === b.modifiers.shift &&
    a.modifiers.meta === b.modifiers.meta
  );
}

/** Compare two keybindings for equality */
function keybindingsEqual(a: Keybinding | null, b: Keybinding | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.keystrokes.length !== b.keystrokes.length) return false;
  
  return a.keystrokes.every((keystroke, index) => 
    keystrokesEqual(keystroke, b.keystrokes[index])
  );
}

/** Parse a keyboard event into a Keystroke */
export function keyboardEventToKeystroke(event: KeyboardEvent): Keystroke | null {
  // Ignore modifier-only keys
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
    return null;
  }
  
  return {
    key: event.key,
    modifiers: {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
    },
  };
}

/** Parse a keybinding string like "Ctrl+Shift+P" into a Keybinding */
function parseKeybindingStringFn(str: string): Keybinding | null {
  if (!str || str.trim() === "") return null;
  
  const chords = str.trim().split(/\s+/);
  const keystrokes: Keystroke[] = [];
  
  for (const chord of chords) {
    const parts = chord.split("+");
    const modifiers: KeyModifiers = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    };
    
    let key = "";
    
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (lower === "ctrl" || lower === "control") {
        modifiers.ctrl = true;
      } else if (lower === "alt") {
        modifiers.alt = true;
      } else if (lower === "shift") {
        modifiers.shift = true;
      } else if (lower === "meta" || lower === "cmd" || lower === "command") {
        modifiers.meta = true;
      } else {
        key = part;
      }
    }
    
    if (key) {
      keystrokes.push({ key, modifiers });
    }
  }
  
  return keystrokes.length > 0 ? { keystrokes } : null;
}

/** Chord mode timeout in milliseconds */
const CHORD_TIMEOUT_MS = 1500;

export function KeymapProvider(props: ParentProps) {
  const [customBindings, setCustomBindings] = createSignal<Record<string, Keybinding | null>>(loadCustomBindings());
  const [customWhenClauses, setCustomWhenClauses] = createSignal<Record<string, string | null>>(loadCustomWhenClauses());
  const [isRecording, setIsRecording] = createSignal(false);
  const [recordingCommandId, setRecordingCommandId] = createSignal<string | null>(null);
  const [recordedKeystrokes, setRecordedKeystrokes] = createSignal<Keystroke[]>([]);
  
  // Context keys store for "when" clause evaluation
  const [contextKeys, setContextKeysStore] = createStore<ContextKeys>({ ...DEFAULT_CONTEXT_KEYS });
  
  // Chord mode state
  const [chordModeActive, setChordModeActive] = createSignal(false);
  const [pendingChordKeystroke, setPendingChordKeystroke] = createSignal<Keystroke | null>(null);
  let chordTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Persist custom bindings when they change
  createEffect(() => {
    saveCustomBindings(customBindings());
  });
  
  // Persist custom when clauses when they change
  createEffect(() => {
    saveCustomWhenClauses(customWhenClauses());
  });
  
  // Update isRecordingKeybinding context key when recording state changes
  createEffect(() => {
    setContextKeysStore("isRecordingKeybinding", isRecording());
  });

  // Compute merged bindings
  const bindings = createMemo((): CommandBinding[] => {
    const custom = customBindings();
    const customWhen = customWhenClauses();
    return DEFAULT_BINDINGS.map(binding => ({
      ...binding,
      customKeybinding: custom[binding.commandId] !== undefined 
        ? custom[binding.commandId] 
        : null,
      customWhen: customWhen[binding.commandId] !== undefined
        ? customWhen[binding.commandId] ?? undefined
        : undefined,
    }));
  });

  // Compute conflicts
  const conflicts = createMemo((): KeybindingConflict[] => {
    const allBindings = bindings();
    const keybindingMap = new Map<string, string[]>();
    
    for (const binding of allBindings) {
      const effectiveBinding = binding.customKeybinding ?? binding.defaultKeybinding;
      if (!effectiveBinding) continue;
      
      const key = formatKeybindingFn(effectiveBinding);
      if (!key) continue;
      
      const existing = keybindingMap.get(key) || [];
      existing.push(binding.commandId);
      keybindingMap.set(key, existing);
    }
    
    const result: KeybindingConflict[] = [];
    for (const [key, commands] of keybindingMap) {
      if (commands.length > 1) {
        const binding = parseKeybindingStringFn(key);
        if (binding) {
          result.push({ keybinding: binding, commands });
        }
      }
    }
    
    return result;
  });

  const getEffectiveBinding = (commandId: string): Keybinding | null => {
    const custom = customBindings();
    if (custom[commandId] !== undefined) {
      return custom[commandId];
    }
    const binding = DEFAULT_BINDINGS.find(b => b.commandId === commandId);
    return binding?.defaultKeybinding ?? null;
  };

  /** Get the effective when clause for a command (custom overrides default) */
  const getEffectiveWhen = (commandId: string): string | undefined => {
    const customWhen = customWhenClauses();
    if (customWhen[commandId] !== undefined) {
      return customWhen[commandId] ?? undefined;
    }
    const binding = DEFAULT_BINDINGS.find(b => b.commandId === commandId);
    return binding?.when;
  };

  const getBindingForKeystroke = (keybinding: Keybinding): CommandBinding[] => {
    return bindings().filter(binding => {
      const effective = binding.customKeybinding ?? binding.defaultKeybinding;
      return keybindingsEqual(effective, keybinding);
    });
  };
  
  // ============================================================================
  // Context Key Management
  // ============================================================================
  
  /** Set a single context key value */
  const setContextKey = <K extends keyof ContextKeys>(key: K, value: ContextKeys[K]): void => {
    setContextKeysStore(key, value);
  };
  
  /** Set multiple context key values at once */
  const setContextKeysBatch = (updates: Partial<ContextKeys>): void => {
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setContextKeysStore(key as keyof ContextKeys, value);
      }
    }
  };
  
  /** Evaluate a when clause against current context keys */
  const evaluateWhen = (when: string | undefined): boolean => {
    return evaluateWhenClause(when, contextKeys);
  };
  
  /** Check if a keybinding matches the given keystroke(s) and context */
  const matchesKeybinding = (binding: CommandBinding, keystrokes: Keystroke | Keystroke[]): boolean => {
    const effective = binding.customKeybinding ?? binding.defaultKeybinding;
    if (!effective) return false;
    
    const keystrokesArray = Array.isArray(keystrokes) ? keystrokes : [keystrokes];
    
    // Check if keystrokes match
    if (effective.keystrokes.length !== keystrokesArray.length) return false;
    
    const keysMatch = effective.keystrokes.every((ks, index) => 
      keystrokesEqual(ks, keystrokesArray[index])
    );
    
    if (!keysMatch) return false;
    
    // Check when clause
    const effectiveWhen = binding.customWhen ?? binding.when;
    if (effectiveWhen && !evaluateWhenClause(effectiveWhen, contextKeys)) {
      return false;
    }
    
    return true;
  };

  const setCustomBinding = (commandId: string, keybinding: Keybinding | null): void => {
    setCustomBindings(prev => ({
      ...prev,
      [commandId]: keybinding,
    }));
  };
  
  /** Set a custom when clause for a command */
  const setCustomWhen = (commandId: string, when: string | null): void => {
    setCustomWhenClauses(prev => ({
      ...prev,
      [commandId]: when,
    }));
  };

  const removeCustomBinding = (commandId: string): void => {
    setCustomBindings(prev => {
      const next = { ...prev };
      delete next[commandId];
      return next;
    });
  };

  const resetToDefault = (commandId: string): void => {
    removeCustomBinding(commandId);
  };

  const resetAllToDefault = (): void => {
    setCustomBindings({});
  };

  const startRecording = (commandId: string): void => {
    setIsRecording(true);
    setRecordingCommandId(commandId);
    setRecordedKeystrokes([]);
  };

  const stopRecording = (): void => {
    setIsRecording(false);
    setRecordingCommandId(null);
  };

  const clearRecording = (): void => {
    setRecordedKeystrokes([]);
  };

  const addRecordedKeystroke = (keystroke: Keystroke): void => {
    setRecordedKeystrokes(prev => {
      // Limit to 2 keystrokes for chord sequences
      if (prev.length >= 2) {
        return [keystroke];
      }
      return [...prev, keystroke];
    });
  };

  const saveRecordedBinding = (): void => {
    const commandId = recordingCommandId();
    const keystrokes = recordedKeystrokes();
    
    if (commandId && keystrokes.length > 0) {
      setCustomBinding(commandId, { keystrokes });
    }
    
    stopRecording();
    clearRecording();
  };

  const exportCustomBindings = (): string => {
    return JSON.stringify(customBindings(), null, 2);
  };

  const importCustomBindings = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed === "object" && parsed !== null) {
        setCustomBindings(parsed);
        return true;
      }
    } catch (e) {
      console.error("[KeymapContext] Failed to import bindings:", e);
    }
    return false;
  };

  // Chord mode functions
  const clearChordTimeout = (): void => {
    if (chordTimeoutId !== null) {
      clearTimeout(chordTimeoutId);
      chordTimeoutId = null;
    }
  };

  const cancelChordMode = (): void => {
    clearChordTimeout();
    setChordModeActive(false);
    setPendingChordKeystroke(null);
  };

  const startChordMode = (keystroke: Keystroke): void => {
    clearChordTimeout();
    setChordModeActive(true);
    setPendingChordKeystroke(keystroke);
    
    // Set timeout to cancel chord mode after 1.5 seconds
    chordTimeoutId = setTimeout(() => {
      cancelChordMode();
    }, CHORD_TIMEOUT_MS);
  };

  const chordState = createMemo((): ChordState => {
    const pending = pendingChordKeystroke();
    return {
      active: chordModeActive(),
      pendingKeystroke: pending,
      indicator: pending ? `(${formatKeystroke(pending)}) waiting for second key...` : "",
    };
  });

  const isChordModeActive = (): boolean => chordModeActive();

  const chordIndicator = (): string => {
    const pending = pendingChordKeystroke();
    return pending ? `(${formatKeystroke(pending)})` : "";
  };

  /** Check if a keystroke is the first part of any chord binding (respects when clauses) */
  const getChordPrefixCommands = (keystroke: Keystroke): CommandBinding[] => {
    return bindings().filter(binding => {
      const effective = binding.customKeybinding ?? binding.defaultKeybinding;
      if (!effective || effective.keystrokes.length < 2) return false;
      
      // Check if the first keystroke matches
      if (!keystrokesEqual(effective.keystrokes[0], keystroke)) return false;
      
      // Check when clause - only return commands whose when clause is satisfied
      const effectiveWhen = binding.customWhen ?? binding.when;
      if (effectiveWhen && !evaluateWhenClause(effectiveWhen, contextKeys)) {
        return false;
      }
      
      return true;
    });
  };

  /** Check if keystroke matches a single-key binding (respects when clauses) */
  const getSingleKeyCommands = (keystroke: Keystroke): CommandBinding[] => {
    return bindings().filter(binding => {
      const effective = binding.customKeybinding ?? binding.defaultKeybinding;
      if (!effective || effective.keystrokes.length !== 1) return false;
      if (!keystrokesEqual(effective.keystrokes[0], keystroke)) return false;
      
      // Check when clause
      const effectiveWhen = binding.customWhen ?? binding.when;
      if (effectiveWhen && !evaluateWhenClause(effectiveWhen, contextKeys)) {
        return false;
      }
      
      return true;
    });
  };

  /** 
   * Handle a keystroke, managing chord mode state.
   * Returns { handled: true, commandId } if a command should be executed,
   * { handled: true, commandId: null } if chord mode was started/waiting,
   * { handled: false, commandId: null } if keystroke was not handled.
   */
  const handleKeystrokeForChord = (keystroke: Keystroke): { handled: boolean; commandId: string | null } => {
    // Don't process chords while recording keybindings
    if (isRecording()) {
      return { handled: false, commandId: null };
    }

    const pending = pendingChordKeystroke();

    if (chordModeActive() && pending) {
      // We're in chord mode, looking for the second key
      clearChordTimeout();
      
      // Find commands that match the full chord (pending + current keystroke)
      const matchingCommands = bindings().filter(binding => {
        const effective = binding.customKeybinding ?? binding.defaultKeybinding;
        if (!effective || effective.keystrokes.length !== 2) return false;
        
        const keysMatch = (
          keystrokesEqual(effective.keystrokes[0], pending) &&
          keystrokesEqual(effective.keystrokes[1], keystroke)
        );
        
        if (!keysMatch) return false;
        
        // Check when clause
        const effectiveWhen = binding.customWhen ?? binding.when;
        if (effectiveWhen && !evaluateWhenClause(effectiveWhen, contextKeys)) {
          return false;
        }
        
        return true;
      });

      // Cancel chord mode regardless of match
      cancelChordMode();

      if (matchingCommands.length > 0) {
        // Found a matching chord command
        return { handled: true, commandId: matchingCommands[0].commandId };
      }

      // Chord didn't match any command, but we handled the keystroke
      return { handled: true, commandId: null };
    }

    // Not in chord mode - check if this keystroke starts a chord
    const chordPrefixCommands = getChordPrefixCommands(keystroke);
    const singleKeyCommands = getSingleKeyCommands(keystroke);

    if (chordPrefixCommands.length > 0) {
      // This keystroke could be the start of a chord
      // Enter chord mode and wait for second key
      startChordMode(keystroke);
      return { handled: true, commandId: null };
    }

    if (singleKeyCommands.length > 0) {
      // This is a single-key binding
      return { handled: true, commandId: singleKeyCommands[0].commandId };
    }

    // Keystroke not handled
    return { handled: false, commandId: null };
  };

  // Global keyboard handler for recording and chord mode escape
  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape to cancel chord mode
      if (event.key === "Escape" && chordModeActive()) {
        event.preventDefault();
        event.stopPropagation();
        cancelChordMode();
        return;
      }
      
      // Recording mode handling
      if (!isRecording()) return;
      
      const keystroke = keyboardEventToKeystroke(event);
      if (keystroke) {
        event.preventDefault();
        event.stopPropagation();
        addRecordedKeystroke(keystroke);
      }
    };
    
    // Focus tracking for context keys
    const updateFocusContext = () => {
      const activeEl = document.activeElement;
      
      // Check if editor has focus (Monaco editor)
      const editorHasFocus = activeEl?.closest(".monaco-editor") !== null;
      setContextKeysStore("editorTextFocus", editorHasFocus);
      
      // Check if terminal has focus
      const terminalHasFocus = activeEl?.closest(".xterm") !== null || 
                               activeEl?.closest("[data-terminal]") !== null;
      setContextKeysStore("terminalFocus", terminalHasFocus);
      
      // Check if any input/textarea has focus
      const isInputFocused = activeEl?.tagName === "INPUT" || 
                             activeEl?.tagName === "TEXTAREA" ||
                             (activeEl as HTMLElement)?.isContentEditable === true;
      setContextKeysStore("inputFocus", isInputFocused);
      
      // Check if search input has focus
      const isSearchFocused = activeEl?.closest("[data-search-input]") !== null ||
                              activeEl?.closest(".search-input") !== null;
      setContextKeysStore("searchInputFocus", isSearchFocused);
      
      // Check if list/tree view has focus
      const isListFocused = activeEl?.closest("[role='listbox']") !== null ||
                            activeEl?.closest("[role='tree']") !== null;
      setContextKeysStore("listFocus", isListFocused);
      setContextKeysStore("treeViewFocus", activeEl?.closest("[role='tree']") !== null);
    };
    
    // Run initial focus check
    updateFocusContext();
    
    // Listen for focus changes
    document.addEventListener("focusin", updateFocusContext);
    document.addEventListener("focusout", updateFocusContext);

    window.addEventListener("keydown", handleKeyDown, true);
    
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", updateFocusContext);
      document.removeEventListener("focusout", updateFocusContext);
      // Clean up chord timeout on unmount
      clearChordTimeout();
    });
  });

  const state: KeymapState = {
    get bindings() { return bindings(); },
    get customBindings() { return customBindings(); },
    get conflicts() { return conflicts(); },
    get isRecording() { return isRecording(); },
    get recordingCommandId() { return recordingCommandId(); },
    get recordedKeystrokes() { return recordedKeystrokes(); },
  };

  const value: KeymapContextValue = {
    state,
    bindings,
    customBindings,
    conflicts,
    isRecording,
    recordingCommandId,
    recordedKeystrokes,
    // Chord mode
    chordState,
    isChordModeActive,
    chordIndicator,
    cancelChordMode,
    // Context keys for "when" clauses
    contextKeys,
    setContextKey,
    setContextKeys: setContextKeysBatch,
    evaluateWhen,
    // Actions
    setCustomBinding,
    setCustomWhen,
    removeCustomBinding,
    resetToDefault,
    resetAllToDefault,
    startRecording,
    stopRecording,
    clearRecording,
    addRecordedKeystroke,
    saveRecordedBinding,
    getEffectiveBinding,
    getEffectiveWhen,
    getBindingForKeystroke,
    matchesKeybinding,
    formatKeybinding: formatKeybindingFn,
    parseKeybindingString: parseKeybindingStringFn,
    exportCustomBindings,
    importCustomBindings,
    // Chord handling
    handleKeystrokeForChord,
    getChordPrefixCommands,
  };

  return (
    <KeymapContext.Provider value={value}>
      {props.children}
    </KeymapContext.Provider>
  );
}

export function useKeymap() {
  const context = useContext(KeymapContext);
  if (!context) {
    throw new Error("useKeymap must be used within KeymapProvider");
  }
  return context;
}
