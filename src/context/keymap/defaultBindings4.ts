import type { CommandBinding } from "./types";

// ============================================================================
// Default Bindings Part 4: VS Code-style editor.action.*, workbench.action.*,
// debug.*, search.*
// ============================================================================

export const BINDINGS_PART4: Omit<CommandBinding, "customKeybinding">[] = [
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
