import { createMemo, type Accessor, type Setter } from "solid-js";
import type { ChordState, CommandBinding, ContextKeys, Keystroke } from "./types";
import { evaluateWhenClause } from "./types";
import { formatKeystroke, keystrokesEqual, CHORD_TIMEOUT_MS } from "./keymapHelpers";

// ============================================================================
// Chord Handling Types
// ============================================================================

export interface ChordHandlingDeps {
  chordModeActive: Accessor<boolean>;
  setChordModeActive: Setter<boolean>;
  pendingChordKeystroke: Accessor<Keystroke | null>;
  setPendingChordKeystroke: Setter<Keystroke | null>;
  chordTimeoutRef: { current: ReturnType<typeof setTimeout> | null };
  isRecording: Accessor<boolean>;
  bindings: Accessor<CommandBinding[]>;
  contextKeys: ContextKeys;
}

export interface ChordHandlers {
  clearChordTimeout: () => void;
  cancelChordMode: () => void;
  startChordMode: (keystroke: Keystroke) => void;
  chordState: Accessor<ChordState>;
  isChordModeActive: () => boolean;
  chordIndicator: () => string;
  getChordPrefixCommands: (keystroke: Keystroke) => CommandBinding[];
  getSingleKeyCommands: (keystroke: Keystroke) => CommandBinding[];
  handleKeystrokeForChord: (keystroke: Keystroke) => { handled: boolean; commandId: string | null };
}

// ============================================================================
// Chord Handling Factory
// ============================================================================

export function createChordHandlers(deps: ChordHandlingDeps): ChordHandlers {
  const {
    chordModeActive, setChordModeActive,
    pendingChordKeystroke, setPendingChordKeystroke,
    chordTimeoutRef, isRecording, bindings, contextKeys,
  } = deps;

  const clearChordTimeout = (): void => {
    if (chordTimeoutRef.current !== null) {
      clearTimeout(chordTimeoutRef.current);
      chordTimeoutRef.current = null;
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
    chordTimeoutRef.current = setTimeout(() => {
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

  const getChordPrefixCommands = (keystroke: Keystroke): CommandBinding[] => {
    return bindings().filter(binding => {
      const effective = binding.customKeybinding ?? binding.defaultKeybinding;
      if (!effective || effective.keystrokes.length < 2) return false;
      if (!keystrokesEqual(effective.keystrokes[0], keystroke)) return false;
      const effectiveWhen = binding.customWhen ?? binding.when;
      if (effectiveWhen && !evaluateWhenClause(effectiveWhen, contextKeys)) {
        return false;
      }
      return true;
    });
  };

  const getSingleKeyCommands = (keystroke: Keystroke): CommandBinding[] => {
    return bindings().filter(binding => {
      const effective = binding.customKeybinding ?? binding.defaultKeybinding;
      if (!effective || effective.keystrokes.length !== 1) return false;
      if (!keystrokesEqual(effective.keystrokes[0], keystroke)) return false;
      const effectiveWhen = binding.customWhen ?? binding.when;
      if (effectiveWhen && !evaluateWhenClause(effectiveWhen, contextKeys)) {
        return false;
      }
      return true;
    });
  };

  const handleKeystrokeForChord = (keystroke: Keystroke): { handled: boolean; commandId: string | null } => {
    if (isRecording()) {
      return { handled: false, commandId: null };
    }

    const pending = pendingChordKeystroke();

    if (chordModeActive() && pending) {
      clearChordTimeout();
      const matchingCommands = bindings().filter(binding => {
        const effective = binding.customKeybinding ?? binding.defaultKeybinding;
        if (!effective || effective.keystrokes.length !== 2) return false;
        const keysMatch = (
          keystrokesEqual(effective.keystrokes[0], pending) &&
          keystrokesEqual(effective.keystrokes[1], keystroke)
        );
        if (!keysMatch) return false;
        const effectiveWhen = binding.customWhen ?? binding.when;
        if (effectiveWhen && !evaluateWhenClause(effectiveWhen, contextKeys)) {
          return false;
        }
        return true;
      });
      cancelChordMode();
      if (matchingCommands.length > 0) {
        return { handled: true, commandId: matchingCommands[0].commandId };
      }
      return { handled: true, commandId: null };
    }

    const chordPrefixCommands = getChordPrefixCommands(keystroke);
    const singleKeyCommands = getSingleKeyCommands(keystroke);

    if (chordPrefixCommands.length > 0) {
      startChordMode(keystroke);
      return { handled: true, commandId: null };
    }

    if (singleKeyCommands.length > 0) {
      return { handled: true, commandId: singleKeyCommands[0].commandId };
    }

    return { handled: false, commandId: null };
  };

  return {
    clearChordTimeout,
    cancelChordMode,
    startChordMode,
    chordState,
    isChordModeActive,
    chordIndicator,
    getChordPrefixCommands,
    getSingleKeyCommands,
    handleKeystrokeForChord,
  };
}
