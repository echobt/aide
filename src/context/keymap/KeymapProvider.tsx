import { createContext, useContext, createSignal, createMemo, ParentProps, onMount, onCleanup, createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import type {
  ContextKeys,
  KeymapContextValue,
  KeymapState,
  Keystroke,
  Keybinding,
  KeybindingConflict,
  CommandBinding,
} from "./types";
import { DEFAULT_CONTEXT_KEYS } from "./types";
import { DEFAULT_BINDINGS } from "./defaultBindings";
import {
  loadCustomBindings,
  saveCustomBindings,
  loadCustomWhenClauses,
  saveCustomWhenClauses,
  keyboardEventToKeystroke,
} from "./keymapHelpers";
import { createChordHandlers } from "./chordHandling";
import { createKeymapActions, formatKeybindingFn, parseKeybindingStringFn } from "./keymapActions";

const KeymapContext = createContext<KeymapContextValue>();

export function KeymapProvider(props: ParentProps) {
  const [customBindings, setCustomBindings] = createSignal<Record<string, Keybinding | null>>(loadCustomBindings());
  const [customWhenClauses, setCustomWhenClauses] = createSignal<Record<string, string | null>>(loadCustomWhenClauses());
  const [isRecording, setIsRecording] = createSignal(false);
  const [recordingCommandId, setRecordingCommandId] = createSignal<string | null>(null);
  const [recordedKeystrokes, setRecordedKeystrokes] = createSignal<Keystroke[]>([]);
  const [contextKeys, setContextKeysStore] = createStore<ContextKeys>({ ...DEFAULT_CONTEXT_KEYS });

  // Chord mode signals
  const [chordModeActive, setChordModeActive] = createSignal(false);
  const [pendingChordKeystroke, setPendingChordKeystroke] = createSignal<Keystroke | null>(null);
  const chordTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };

  // Persist custom bindings when they change
  createEffect(() => { saveCustomBindings(customBindings()); });
  createEffect(() => { saveCustomWhenClauses(customWhenClauses()); });
  createEffect(() => { setContextKeysStore("isRecordingKeybinding", isRecording()); });

  // Compute merged bindings
  const bindings = createMemo((): CommandBinding[] => {
    const custom = customBindings();
    const customWhen = customWhenClauses();
    return DEFAULT_BINDINGS.map(binding => ({
      ...binding,
      customKeybinding: custom[binding.commandId] !== undefined ? custom[binding.commandId] : null,
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

  // ============================================================================
  // Create extracted handlers
  // ============================================================================

  const chordHandlers = createChordHandlers({
    chordModeActive, setChordModeActive,
    pendingChordKeystroke, setPendingChordKeystroke,
    chordTimeoutRef, isRecording, bindings, contextKeys,
  });

  const actions = createKeymapActions({
    customBindings, setCustomBindings,
    customWhenClauses, setCustomWhenClauses,
    isRecording, setIsRecording,
    recordingCommandId, setRecordingCommandId,
    recordedKeystrokes, setRecordedKeystrokes,
    contextKeys, setContextKeysStore, bindings,
  });

  // ============================================================================
  // Global keyboard and focus handlers
  // ============================================================================

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && chordHandlers.isChordModeActive()) {
        event.preventDefault();
        event.stopPropagation();
        chordHandlers.cancelChordMode();
        return;
      }
      if (!isRecording()) return;
      const keystroke = keyboardEventToKeystroke(event);
      if (keystroke) {
        event.preventDefault();
        event.stopPropagation();
        actions.addRecordedKeystroke(keystroke);
      }
    };

    const updateFocusContext = () => {
      const activeEl = document.activeElement;
      const editorHasFocus = activeEl?.closest(".monaco-editor") !== null;
      setContextKeysStore("editorTextFocus", editorHasFocus);
      const terminalHasFocus = activeEl?.closest(".xterm") !== null ||
                               activeEl?.closest("[data-terminal]") !== null;
      setContextKeysStore("terminalFocus", terminalHasFocus);
      const isInputFocused = activeEl?.tagName === "INPUT" ||
                             activeEl?.tagName === "TEXTAREA" ||
                             (activeEl as HTMLElement)?.isContentEditable === true;
      setContextKeysStore("inputFocus", isInputFocused);
      const isSearchFocused = activeEl?.closest("[data-search-input]") !== null ||
                              activeEl?.closest(".search-input") !== null;
      setContextKeysStore("searchInputFocus", isSearchFocused);
      const isListFocused = activeEl?.closest("[role='listbox']") !== null ||
                            activeEl?.closest("[role='tree']") !== null;
      setContextKeysStore("listFocus", isListFocused);
      setContextKeysStore("treeViewFocus", activeEl?.closest("[role='tree']") !== null);
    };

    updateFocusContext();
    document.addEventListener("focusin", updateFocusContext);
    document.addEventListener("focusout", updateFocusContext);
    window.addEventListener("keydown", handleKeyDown, true);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", updateFocusContext);
      document.removeEventListener("focusout", updateFocusContext);
      chordHandlers.clearChordTimeout();
    });
  });

  // ============================================================================
  // Context value assembly
  // ============================================================================

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
    chordState: chordHandlers.chordState,
    isChordModeActive: chordHandlers.isChordModeActive,
    chordIndicator: chordHandlers.chordIndicator,
    cancelChordMode: chordHandlers.cancelChordMode,
    contextKeys,
    setContextKey: actions.setContextKey,
    setContextKeys: actions.setContextKeysBatch,
    evaluateWhen: actions.evaluateWhen,
    setCustomBinding: actions.setCustomBinding,
    setCustomWhen: actions.setCustomWhen,
    removeCustomBinding: actions.removeCustomBinding,
    resetToDefault: actions.resetToDefault,
    resetAllToDefault: actions.resetAllToDefault,
    startRecording: actions.startRecording,
    stopRecording: actions.stopRecording,
    clearRecording: actions.clearRecording,
    addRecordedKeystroke: actions.addRecordedKeystroke,
    saveRecordedBinding: actions.saveRecordedBinding,
    getEffectiveBinding: actions.getEffectiveBinding,
    getEffectiveWhen: actions.getEffectiveWhen,
    getBindingForKeystroke: actions.getBindingForKeystroke,
    matchesKeybinding: actions.matchesKeybinding,
    formatKeybinding: formatKeybindingFn,
    parseKeybindingString: parseKeybindingStringFn,
    exportCustomBindings: actions.exportCustomBindings,
    importCustomBindings: actions.importCustomBindings,
    handleKeystrokeForChord: chordHandlers.handleKeystrokeForChord,
    getChordPrefixCommands: chordHandlers.getChordPrefixCommands,
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
