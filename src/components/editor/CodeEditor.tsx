import {
  Show,
  createEffect,
  onMount,
  onCleanup,
  createSignal,
  createMemo,
} from "solid-js";
import { useEditor, OpenFile } from "@/context/EditorContext";
import { useVim } from "@/context/VimContext";
import { useSettings } from "@/context/SettingsContext";
import { useTesting } from "@/context/TestingContext";
import { useDebug, InlineValueInfo } from "@/context/DebugContext";
import { useCollabEditor } from "@/hooks/useCollabEditor";
import { useSnippetCompletions } from "@/hooks/useSnippetCompletions";
import { editorLogger } from "../../utils/logger";
import type * as Monaco from "monaco-editor";
import { VimMode } from "./VimMode";
import { LanguageTools } from "./LanguageTools";
import { EditorSkeleton } from "./EditorSkeleton";
import {
  GitGutterDecorations,
  goToNextChange,
  goToPrevChange,
} from "./GitGutterDecorations";
import {
  MonacoManager,
  LARGE_FILE_THRESHOLDS,
  type LargeFileSettings,
} from "@/utils/monacoManager";
import { invoke } from "@tauri-apps/api/core";
import {
  balanceInward,
  balanceOutward,
  wrapWithAbbreviation,
  getSelectionForWrap,
  expandEmmetAbbreviation,
  getAbbreviationRange,
} from "@/utils/emmet";
import {
  InlineBlameManager,
  InlineBlameMode,
  getInlineBlameMode,
  setInlineBlameMode,
  toggleInlineBlame,
} from "./InlineBlame";
import {
  PeekWidget,
  showPeekWidget,
  hidePeekWidget,
  type PeekLocation,
} from "./PeekWidget";
import { PeekReferences, showPeekReferences } from "./PeekReferences";
import { showReferencesPanel } from "../ReferencesPanel";
import { FindReplaceWidget } from "./FindReplaceWidget";
import { StickyScrollWidget } from "./StickyScrollWidget";
import { RenameWidget, showRenameWidget } from "./RenameWidget";
import type { RenameLocation } from "@/types/editor";
import { DebugHoverWidget, useDebugHover } from "../debug/DebugHoverWidget";
import { InlineValuesOverlay } from "../debug/InlineValuesDecorations";
import { ExceptionWidget } from "../debug/ExceptionWidget";
import {
  ParameterHintsWidget,
  useParameterHints,
} from "./ParameterHintsWidget";
import type {
  SignatureHelp,
  Position as LSPPosition,
} from "@/context/LSPContext";
import { LightBulbWidget } from "./LightBulbWidget";
import {
  registerAllProviders,
  updateInlayHintSettings,
  updateFormatOnTypeSettings,
  updateCodeLensSettings,
  updateDebugHoverState,
  updateLinkedEditingEnabled,
  updateUnicodeHighlightSettings,
  getInlayHintSettings,
  getFormatOnTypeSettings,
  getUnicodeHighlightSettings,
  findLinkedEditingRanges,
  getTagAtPosition,
  findMatchingTag,
} from "./modules/EditorLSP";
import {
  estimateLineCount,
  applyCoverageDecorations,
  clearCoverageDecorations,
  toSnakeCase,
  toCamelCase,
  toPascalCase,
  toKebabCase,
  toConstantCase,
} from "./modules/EditorUtils";
import { LANGUAGE_MAP } from "./modules/EditorTypes";
import { setupFormatOnPaste } from "./modules/EditorActions";

/**
 * Track whether LSP providers have been registered globally.
 * This prevents duplicate registrations across editor instances.
 */
let providersRegistered = false;

// ============================================================================
// Selection Range Types (LSP Specification)
// ============================================================================

/** LSP SelectionRange for smart expand/shrink selection */
interface LSPSelectionRange {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  parent?: LSPSelectionRange;
}

/** LSP Selection Range response */
interface LSPSelectionRangeResponse {
  ranges: LSPSelectionRange[] | null;
}

// ============================================================================
// Smart Select Manager - Tracks selection history for expand/shrink
// ============================================================================

/**
 * Manages smart selection with history tracking.
 * Supports expand (Word → String → Expression → Statement → Block → Function → Class → File)
 * and shrink (reverse through history) operations.
 */
class SmartSelectManager {
  private selectionHistory: Map<string, Monaco.IRange[]> = new Map();
  private lastPosition: Map<string, { line: number; column: number }> =
    new Map();
  private cachedRanges: Map<string, LSPSelectionRange[]> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 2000;

  /**
   * Get a unique key for tracking selection per editor instance
   */
  private getEditorKey(uri: string): string {
    return uri;
  }

  /**
   * Clear selection history for an editor (also serves as clearFileCache)
   */
  clearHistory(uri: string): void {
    const key = this.getEditorKey(uri);
    this.selectionHistory.delete(key);
    this.lastPosition.delete(key);
    this.cachedRanges.delete(key);
    this.cacheTimestamps.delete(key);
  }

  /**
   * Clear cache for a specific file URI (alias for clearHistory)
   */
  clearFileCache(uri: string): void {
    this.clearHistory(uri);
  }

  /**
   * Clear all caches - call on component cleanup
   */
  clearAllCaches(): void {
    this.selectionHistory.clear();
    this.lastPosition.clear();
    this.cachedRanges.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Prune old caches based on timestamp - call periodically to prevent memory leaks
   * @param maxAge Maximum age in milliseconds (default: 5 minutes)
   */
  pruneOldCaches(maxAge: number = 300000): void {
    const now = Date.now();
    for (const [uri, timestamp] of this.cacheTimestamps) {
      if (now - timestamp > maxAge) {
        this.clearFileCache(uri);
      }
    }
  }

  /**
   * Check if the cursor has moved, invalidating history
   */
  private hasPositionChanged(
    uri: string,
    currentPos: { line: number; column: number },
  ): boolean {
    const key = this.getEditorKey(uri);
    const lastPos = this.lastPosition.get(key);
    if (!lastPos) return true;
    return (
      lastPos.line !== currentPos.line || lastPos.column !== currentPos.column
    );
  }

  /**
   * Update the tracked position
   */
  private updatePosition(
    uri: string,
    pos: { line: number; column: number },
  ): void {
    const key = this.getEditorKey(uri);
    this.lastPosition.set(key, { ...pos });
  }

  /**
   * Push a selection to history
   */
  private pushToHistory(uri: string, range: Monaco.IRange): void {
    const key = this.getEditorKey(uri);
    const history = this.selectionHistory.get(key) || [];

    // Don't add duplicates
    const lastRange = history[history.length - 1];
    if (
      lastRange &&
      lastRange.startLineNumber === range.startLineNumber &&
      lastRange.startColumn === range.startColumn &&
      lastRange.endLineNumber === range.endLineNumber &&
      lastRange.endColumn === range.endColumn
    ) {
      return;
    }

    history.push({ ...range });
    this.selectionHistory.set(key, history);
  }

  /**
   * Pop from selection history (for shrink)
   */
  private popFromHistory(uri: string): Monaco.IRange | null {
    const key = this.getEditorKey(uri);
    const history = this.selectionHistory.get(key) || [];

    if (history.length <= 1) {
      return null;
    }

    // Remove current selection
    history.pop();
    this.selectionHistory.set(key, history);

    // Return previous selection
    return history[history.length - 1] || null;
  }

  /**
   * Get cached LSP selection ranges or fetch new ones
   */
  private async getSelectionRanges(
    uri: string,
    position: { line: number; character: number },
  ): Promise<LSPSelectionRange[] | null> {
    const key = this.getEditorKey(uri);
    const now = Date.now();
    const cachedTimestamp = this.cacheTimestamps.get(key);

    // Use cache if valid
    if (cachedTimestamp && now - cachedTimestamp < this.CACHE_TTL_MS) {
      return this.cachedRanges.get(key) || null;
    }

    try {
      const response = await invoke<LSPSelectionRangeResponse>(
        "lsp_selection_range",
        {
          params: {
            uri,
            positions: [position],
          },
        },
      );

      if (response?.ranges && response.ranges.length > 0) {
        this.cachedRanges.set(key, response.ranges);
        this.cacheTimestamps.set(key, now);
        return response.ranges;
      }
    } catch (error) {
      console.debug("LSP selection range not available:", error);
    }

    return null;
  }

  /**
   * Convert LSP SelectionRange to flat array of Monaco ranges (from innermost to outermost)
   */
  private flattenSelectionRanges(
    lspRange: LSPSelectionRange,
    _monaco: typeof Monaco,
  ): Monaco.IRange[] {
    const ranges: Monaco.IRange[] = [];
    let current: LSPSelectionRange | undefined = lspRange;

    while (current) {
      ranges.push({
        startLineNumber: current.range.start.line + 1,
        startColumn: current.range.start.character + 1,
        endLineNumber: current.range.end.line + 1,
        endColumn: current.range.end.character + 1,
      });
      current = current.parent;
    }

    return ranges;
  }

  /**
   * Find the next larger selection from the available ranges
   */
  private findNextLargerRange(
    currentSelection: Monaco.IRange,
    availableRanges: Monaco.IRange[],
  ): Monaco.IRange | null {
    // Find the smallest range that fully contains the current selection
    for (const range of availableRanges) {
      const containsCurrent =
        (range.startLineNumber < currentSelection.startLineNumber ||
          (range.startLineNumber === currentSelection.startLineNumber &&
            range.startColumn <= currentSelection.startColumn)) &&
        (range.endLineNumber > currentSelection.endLineNumber ||
          (range.endLineNumber === currentSelection.endLineNumber &&
            range.endColumn >= currentSelection.endColumn));

      const isLarger =
        range.startLineNumber < currentSelection.startLineNumber ||
        range.startColumn < currentSelection.startColumn ||
        range.endLineNumber > currentSelection.endLineNumber ||
        range.endColumn > currentSelection.endColumn;

      if (containsCurrent && isLarger) {
        return range;
      }
    }
    return null;
  }

  /**
   * Expand selection - goes from smaller to larger scope
   * Order: Word → String → Expression → Statement → Block → Function → Class → File
   */
  async expandSelection(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ): Promise<void> {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return;

    const uri = model.uri.toString();
    const position = selection.getPosition();

    // Check if position changed - reset history if so
    if (
      this.hasPositionChanged(uri, {
        line: position.lineNumber,
        column: position.column,
      })
    ) {
      this.clearHistory(uri);
    }

    // Store current selection in history before expanding
    this.pushToHistory(uri, {
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn,
      endLineNumber: selection.endLineNumber,
      endColumn: selection.endColumn,
    });

    // Try to get LSP selection ranges first
    const lspRanges = await this.getSelectionRanges(uri, {
      line: position.lineNumber - 1,
      character: position.column - 1,
    });

    if (lspRanges && lspRanges.length > 0) {
      // Use LSP selection ranges
      const flatRanges = this.flattenSelectionRanges(lspRanges[0], monaco);
      const nextRange = this.findNextLargerRange(
        {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        },
        flatRanges,
      );

      if (nextRange) {
        editor.setSelection(
          new monaco.Selection(
            nextRange.startLineNumber,
            nextRange.startColumn,
            nextRange.endLineNumber,
            nextRange.endColumn,
          ),
        );
        this.pushToHistory(uri, nextRange);
        this.updatePosition(uri, {
          line: position.lineNumber,
          column: position.column,
        });
        return;
      }
    }

    // Fall back to Monaco's built-in smart select
    editor.trigger("smartSelect", "editor.action.smartSelect.expand", null);

    // Record the new selection in history after Monaco expands
    const newSelection = editor.getSelection();
    if (newSelection) {
      this.pushToHistory(uri, {
        startLineNumber: newSelection.startLineNumber,
        startColumn: newSelection.startColumn,
        endLineNumber: newSelection.endLineNumber,
        endColumn: newSelection.endColumn,
      });
    }
    this.updatePosition(uri, {
      line: position.lineNumber,
      column: position.column,
    });
  }

  /**
   * Shrink selection - goes from larger to smaller scope (reverse of expand)
   */
  shrinkSelection(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ): void {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return;

    const uri = model.uri.toString();

    // Try to pop from our history first
    const previousRange = this.popFromHistory(uri);

    if (previousRange) {
      editor.setSelection(
        new monaco.Selection(
          previousRange.startLineNumber,
          previousRange.startColumn,
          previousRange.endLineNumber,
          previousRange.endColumn,
        ),
      );
      return;
    }

    // Fall back to Monaco's built-in smart select shrink
    editor.trigger("smartSelect", "editor.action.smartSelect.shrink", null);
  }
}

/** Global Smart Select Manager instance */
const smartSelectManager = new SmartSelectManager();

let monacoInstance: typeof Monaco | null = null;

// Store event listeners for cleanup
const eventCleanupFns: (() => void)[] = [];

// Inline blame manager instance
let inlineBlameManager: InlineBlameManager | null = null;

/** Track format-on-paste enabled state */
let formatOnPasteEnabled = false;

/** Track format-on-paste disposable for cleanup */
let formatOnPasteDisposable: Monaco.IDisposable | null = null;

/**
 * Update format-on-paste enabled state from settings.
 */
function updateFormatOnPasteEnabled(enabled: boolean): void {
  formatOnPasteEnabled = enabled;
}

/** Global linked editing settings state */
let linkedEditingEnabled = true;

/**
 * Setup linked editing visual indicators and JSX self-closing conversion.
 * This function adds:
 * 1. Visual decorations showing linked tag ranges
 * 2. JSX self-closing tag conversion support (<div></div> -> <div /> and vice versa)
 */
function setupLinkedEditing(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
): void {
  // Track linked editing decorations for visual indicator
  let linkedEditDecorations: string[] = [];

  // Debounce timer for updating decorations
  let decorationUpdateTimer: number | null = null;

  /**
   * Update visual decorations to highlight linked tag ranges.
   */
  const updateLinkedEditDecorations = () => {
    if (!linkedEditingEnabled) {
      linkedEditDecorations = editor.deltaDecorations(
        linkedEditDecorations,
        [],
      );
      return;
    }

    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) {
      linkedEditDecorations = editor.deltaDecorations(
        linkedEditDecorations,
        [],
      );
      return;
    }

    const linkedRanges = findLinkedEditingRanges(model, position, monaco);
    if (!linkedRanges || linkedRanges.ranges.length < 2) {
      linkedEditDecorations = editor.deltaDecorations(
        linkedEditDecorations,
        [],
      );
      return;
    }

    // Create decorations for both linked ranges
    const newDecorations = linkedRanges.ranges.map((range, index) => ({
      range,
      options: {
        className: "linked-editing-range",
        // Use border styling for visual indication
        borderColor: "var(--cortex-info)",
        // Different styling for current vs matched tag
        inlineClassName:
          index === 0 ? "linked-editing-current" : "linked-editing-matched",
        // Show in overview ruler
        overviewRuler: {
          color: "var(--cortex-info)80",
          position: monaco.editor.OverviewRulerLane.Center,
        },
      },
    }));

    linkedEditDecorations = editor.deltaDecorations(
      linkedEditDecorations,
      newDecorations,
    );
  };

  // Update decorations on cursor position change (debounced)
  editor.onDidChangeCursorPosition(() => {
    if (decorationUpdateTimer !== null) {
      window.clearTimeout(decorationUpdateTimer);
    }
    decorationUpdateTimer = window.setTimeout(() => {
      updateLinkedEditDecorations();
      decorationUpdateTimer = null;
    }, 50) as unknown as number;
  });

  // Clear decorations when editor loses focus
  editor.onDidBlurEditorWidget(() => {
    linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
  });

  /**
   * Add toggle linked editing action
   */
  editor.addAction({
    id: "toggle-linked-editing",
    label: "Toggle Linked Editing",
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
    ],
    run: (ed) => {
      const newEnabled = !linkedEditingEnabled;
      updateLinkedEditingEnabled(newEnabled);
      ed.updateOptions({ linkedEditing: newEnabled });

      // Clear decorations if disabled
      if (!newEnabled) {
        linkedEditDecorations = ed.deltaDecorations(linkedEditDecorations, []);
      } else {
        updateLinkedEditDecorations();
      }

      // Emit event for settings sync
      window.dispatchEvent(
        new CustomEvent("editor-linked-editing-changed", {
          detail: { enabled: newEnabled },
        }),
      );
    },
  });

  /**
   * Add JSX self-closing tag conversion action.
   * Converts <tag></tag> to <tag /> and vice versa.
   */
  editor.addAction({
    id: "convert-jsx-tag",
    label: "Convert JSX Tag (Self-closing ↔ Paired)",
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Slash,
    ],
    run: (ed) => {
      const model = ed.getModel();
      const position = ed.getPosition();
      if (!model || !position) return;

      const lineContent = model.getLineContent(position.lineNumber);
      const tagInfo = getTagAtPosition(lineContent, position.column);

      if (!tagInfo) return;

      const { tagName, isClosingTag, isSelfClosing, startColumn } = tagInfo;

      if (isSelfClosing) {
        // Convert self-closing to paired tags: <tag /> -> <tag></tag>
        // Find the self-closing tag pattern
        const selfClosingPattern = new RegExp(`<${tagName}([^>]*)/>`);
        const match = selfClosingPattern.exec(lineContent);

        if (match) {
          const fullMatchStart = match.index + 1; // 1-based
          const fullMatchEnd = fullMatchStart + match[0].length;
          const attributes = match[1];

          // Replace with paired tags
          const newText = `<${tagName}${attributes}></${tagName}>`;
          const editRange = new monaco.Range(
            position.lineNumber,
            fullMatchStart,
            position.lineNumber,
            fullMatchEnd,
          );

          ed.executeEdits("convert-jsx-tag", [
            {
              range: editRange,
              text: newText,
            },
          ]);

          // Position cursor inside the opening tag
          ed.setPosition({
            lineNumber: position.lineNumber,
            column: fullMatchStart + tagName.length + 1 + attributes.length,
          });
        }
      } else if (!isClosingTag) {
        // Convert paired tags to self-closing: <tag></tag> -> <tag />
        const content = model.getValue();
        const matchingRange = findMatchingTag(
          content,
          model,
          position.lineNumber,
          startColumn,
          startColumn + tagName.length,
          tagName,
          false,
          monaco,
        );

        if (matchingRange) {
          // Get opening tag line content
          const openingTagLine = model.getLineContent(position.lineNumber);

          // Find the full opening tag including attributes
          const openingTagPattern = new RegExp(`<${tagName}([^>]*)>`);
          const openingMatch = openingTagPattern.exec(openingTagLine);

          if (openingMatch) {
            const openingStart = openingMatch.index + 1; // 1-based
            const openingEnd = openingStart + openingMatch[0].length;
            const attributes = openingMatch[1].trimEnd();

            // Calculate the full range from opening tag to closing tag
            const fullRange = new monaco.Range(
              position.lineNumber,
              openingStart,
              matchingRange.endLineNumber,
              matchingRange.endColumn + 1, // Include the '>'
            );

            // Check if there's content between tags
            const contentBetween = model
              .getValueInRange(
                new monaco.Range(
                  position.lineNumber,
                  openingEnd,
                  matchingRange.startLineNumber,
                  matchingRange.startColumn - 2, // Before '</'
                ),
              )
              .trim();

            // Only convert if empty (no content between tags)
            if (contentBetween === "") {
              const newText = `<${tagName}${attributes} />`;

              ed.executeEdits("convert-jsx-tag", [
                {
                  range: fullRange,
                  text: newText,
                },
              ]);

              // Position cursor before the />
              ed.setPosition({
                lineNumber: position.lineNumber,
                column: openingStart + newText.length - 2,
              });
            }
          }
        }
      }
    },
  });

  // Cleanup on dispose
  editor.onDidDispose(() => {
    if (decorationUpdateTimer !== null) {
      window.clearTimeout(decorationUpdateTimer);
    }
  });
}

interface CodeEditorProps {
  file?: OpenFile;
  groupId?: string;
}

export function CodeEditor(props: CodeEditorProps) {
  const { state, updateFileContent, saveFile, updateCursorInfo } = useEditor();
  const vim = useVim();
  const {
    state: settingsState,
    updateEditorSetting,
    getEffectiveEditorSettings,
  } = useSettings();
  const testing = useTesting();
  const debug = useDebug();
  let containerRef: HTMLDivElement | undefined;
  let editorInstance: Monaco.editor.IStandaloneCodeEditor | null = null;
  let isDisposed = false; // Track if component is being disposed
  const [isLoading, setIsLoading] = createSignal(true);
  const [currentEditor, setCurrentEditor] =
    createSignal<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [currentMonaco, setCurrentMonaco] = createSignal<typeof Monaco | null>(
    null,
  );
  const [agentActive, setAgentActive] = createSignal(false); // Orange border when agent is reading/editing
  const [isDraggingOver, setIsDraggingOver] = createSignal(false); // Drop indicator when dragging over editor
  const [findReplaceOpen, setFindReplaceOpen] = createSignal(false); // Find/Replace widget visibility
  const [findReplaceShowReplace, setFindReplaceShowReplace] =
    createSignal(false); // Show replace section

  // Debug Hover Widget integration - provides rich variable inspection during debugging
  const debugHover = useDebugHover();

  // PERFORMANCE: Memoize activeFile to prevent recalculation on every access
  // This is critical because state.openFiles.find() creates reactive dependencies
  // NOTE: Access props.file.id to track changes in SolidJS reactive system
  const activeFile = createMemo(() => {
    // Access the file ID to create a reactive dependency on props.file changes
    const propsFileId = props.file?.id;
    if (props.file && propsFileId) return props.file;
    // Only re-run when activeFileId or openFiles actually change
    const activeId = state.activeFileId;
    return state.openFiles.find((f) => f.id === activeId);
  });

  // Get current file ID for collaboration
  const currentFileIdMemo = createMemo(() => activeFile()?.id || null);

  // Get current file URI for Language Tools
  const currentUri = createMemo(() => {
    const file = activeFile();
    return file ? `file://${file.path.replace(/\\/g, "/")}` : undefined;
  });

  // Get current file path for Git Gutter Decorations
  const currentFilePathMemo = createMemo(() => activeFile()?.path || null);

  // Collaboration integration - displays remote cursors and sends local cursor updates
  useCollabEditor({
    editor: currentEditor(),
    monaco: currentMonaco(),
    fileId: currentFileIdMemo(),
  });

  // Get current language for snippets
  const currentLanguage = createMemo(() => {
    const file = activeFile();
    return file
      ? LANGUAGE_MAP[file.language] || file.language || "plaintext"
      : "plaintext";
  });

  // Sticky Scroll settings - memoized from settings context
  const stickyScrollEnabled = createMemo(() => {
    const langSettings = getEffectiveEditorSettings(currentLanguage());
    return langSettings.stickyScrollEnabled ?? false;
  });

  const stickyScrollMaxLines = createMemo(() => {
    return settingsState.settings.editor.stickyScrollMaxLines ?? 5;
  });

  // Get editor font settings for StickyScrollWidget
  const editorFontFamily = createMemo(() => {
    const langSettings = getEffectiveEditorSettings(currentLanguage());
    return (
      langSettings.fontFamily ??
      "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace"
    );
  });

  const editorFontSize = createMemo(() => {
    const langSettings = getEffectiveEditorSettings(currentLanguage());
    return langSettings.fontSize ?? 13;
  });

  const editorLineHeight = createMemo(() => {
    const langSettings = getEffectiveEditorSettings(currentLanguage());
    const fontSize = langSettings.fontSize ?? 13;
    const lineHeightMultiplier = langSettings.lineHeight ?? 1.5;
    return Math.round(fontSize * lineHeightMultiplier);
  });

  // Snippet completions integration - provides snippet suggestions in autocomplete
  useSnippetCompletions({
    editor: currentEditor(),
    monaco: currentMonaco(),
    language: currentLanguage(),
  });

  // Function to request signature help from LSP for Parameter Hints Widget
  const getSignatureHelpFromLSP = async (
    position: LSPPosition,
    triggerCharacter?: string,
    isRetrigger?: boolean,
  ): Promise<SignatureHelp | null> => {
    const file = activeFile();
    const editor = currentEditor();
    if (!file || !editor) return null;

    const model = editor.getModel();
    if (!model) return null;

    const languageId = model.getLanguageId();
    const uri = file.path;

    try {
      const result = await invoke<SignatureHelp | null>("lsp_signature_help", {
        serverId: languageId,
        params: {
          uri,
          position,
          trigger_kind: triggerCharacter ? 2 : isRetrigger ? 3 : 1, // 1=Invoked, 2=TriggerCharacter, 3=ContentChange
          trigger_character: triggerCharacter,
          is_retrigger: isRetrigger ?? false,
        },
      });
      return result;
    } catch (err) {
      console.debug("Signature help request failed:", err);
      return null;
    }
  };

  // Parameter Hints Widget integration - shows function signature help on '(' and ','
  const parameterHints = useParameterHints(
    currentEditor(),
    currentMonaco(),
    getSignatureHelpFromLSP,
  );

  // Sync code lens settings with the provider
  createEffect(() => {
    const codeLensConfig = settingsState.settings.editor.codeLens;
    if (codeLensConfig) {
      updateCodeLensSettings(codeLensConfig);
    }
  });

  // Monaco Manager instance for lazy loading and pooling
  const monacoManager = MonacoManager.getInstance();

  onMount(async () => {
    // Only load Monaco when we have a file to display (lazy loading)
    const file = activeFile();
    if (!file) {
      // No file to display, keep loading state but don't load Monaco yet
      setIsLoading(false);
      return;
    }

    // Check if Monaco is already loaded
    if (!monacoManager.isLoaded()) {
      try {
        const monaco = await monacoManager.ensureLoaded();
        monacoInstance = monaco;
        setCurrentMonaco(monaco);

        // Register providers only once globally (not per editor instance)
        if (!providersRegistered) {
          providersRegistered = true;
          // Defer provider registration to avoid blocking initial render
          requestAnimationFrame(() => {
            registerAllProviders(monaco);
          });
        }
      } catch (error) {
        console.error("Failed to load Monaco editor:", error);
        setIsLoading(false);
        return;
      }
    } else {
      monacoInstance = monacoManager.getMonaco();
      setCurrentMonaco(monacoInstance);
    }

    setIsLoading(false);
  });

  let currentFileId: string | null = null;
  let currentFilePath: string | null = null;

  // Track if editor has been initialized for this component instance
  let editorInitialized = false;

  createEffect(() => {
    // Skip effect if component is being disposed
    if (isDisposed) return;

    const effectStart = performance.now();
    const file = activeFile();
    const fileId = file?.id || null;
    const filePath = file?.path || null;

    if (!containerRef || isLoading()) return;

    // Load Monaco on demand when a file is opened
    if (!monacoManager.isLoaded() && file) {
      setIsLoading(true);
      monacoManager
        .ensureLoaded()
        .then((monaco) => {
          monacoInstance = monaco;
          setCurrentMonaco(monaco);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load Monaco editor:", err);
          setIsLoading(false);
        });
      return;
    }

    // Ensure monacoInstance is set after loading
    if (!monacoInstance && monacoManager.isLoaded()) {
      monacoInstance = monacoManager.getMonaco();
      setCurrentMonaco(monacoInstance);
    }

    if (!monacoInstance) return;

    // Check both fileId AND filePath - for preview tabs, id stays the same but path changes
    if (fileId !== currentFileId || filePath !== currentFilePath) {
      console.debug(
        `[CodeEditor] Effect triggered for file change: ${file?.name || "null"}`,
      );
      const modelStart = performance.now();
      // Schedule disposal of the previous file's model (delayed for quick tab switching)
      if (currentFilePath && currentFilePath !== file?.path) {
        monacoManager.scheduleModelDisposal(currentFilePath);
      }

      currentFileId = fileId;
      currentFilePath = file?.path || null;

      if (!file) {
        // No file - release editor if it exists
        if (editorInstance) {
          monacoManager.releaseEditor(editorInstance);
          editorInstance = null;
          setCurrentEditor(null);
        }
        return;
      }

      // Cancel any pending disposal for this file (it's being reopened)
      monacoManager.cancelModelDisposal(file.path);

      const monacoLanguage = LANGUAGE_MAP[file.language] || "plaintext";

      // Calculate line count for large file optimizations (use fast estimation for large files)
      const lineCount = estimateLineCount(file.content);

      // Determine initial cursor style based on vim mode
      const initialCursorStyle =
        vim.enabled() && vim.mode() === "normal" ? "block" : "line";

      // Get language-specific editor settings (merges base with language overrides)
      const langEditorSettings = getEffectiveEditorSettings(monacoLanguage);

      // Base editor options
      const baseOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
        theme: "cortex-dark",
        automaticLayout: true,
        // Line numbers and gutter
        lineNumbers: langEditorSettings.lineNumbers ?? "on",
        lineNumbersMinChars: 4,
        glyphMargin: true,
        folding: langEditorSettings.foldingEnabled ?? true,
        foldingHighlight: true,
        foldingStrategy: "indentation",
        showFoldingControls:
          langEditorSettings.showFoldingControls ?? "mouseover",
        // Minimap Heatmap - carte thermique (pas de texte illisible)
        minimap: {
          enabled: langEditorSettings.minimapEnabled ?? true,
          autohide: "mouseover",
          side: "right",
          showSlider: "mouseover",
          renderCharacters: false, // IMPORTANT: Desactiver le texte
          maxColumn: 80,
          scale: 1,
          size: "proportional",
        },
        // Font settings - use language-specific settings
        fontSize: langEditorSettings.fontSize ?? 13,
        lineHeight:
          (langEditorSettings.lineHeight ?? 1.5) *
          (langEditorSettings.fontSize ?? 13),
        fontFamily:
          langEditorSettings.fontFamily ??
          "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
        fontLigatures: langEditorSettings.fontLigatures ?? true,
        // Indentation - use language-specific settings
        tabSize: langEditorSettings.tabSize ?? 2,
        insertSpaces: langEditorSettings.insertSpaces ?? true,
        detectIndentation: true,
        // Word wrap - use language-specific settings
        wordWrap: langEditorSettings.wordWrap ?? "off",
        // Scrolling
        scrollBeyondLastLine: langEditorSettings.scrollBeyondLastLine ?? false,
        smoothScrolling: langEditorSettings.smoothScrolling ?? true,
        // Cursor - VS Code specs with 500ms blink animation
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        cursorStyle: initialCursorStyle,
        cursorWidth: 2,
        // Rendering - use language-specific settings
        renderLineHighlight: "line",
        renderWhitespace: langEditorSettings.renderWhitespace ?? "selection",
        renderControlCharacters:
          settingsState.settings.editor.renderControlCharacters ?? false,
        // Selection - 3px border radius corners (VS Code spec)
        roundedSelection: true,
        // Brackets - use language-specific settings
        bracketPairColorization: {
          enabled: langEditorSettings.bracketPairColorization ?? true,
          independentColorPoolPerBracketType: true,
        },
        matchBrackets: "always",
        autoClosingBrackets: langEditorSettings.autoClosingBrackets ?? "always",
        autoClosingQuotes: "always",
        autoClosingDelete: "always",
        autoSurround: "languageDefined",
        // Linked editing for synchronized tag renaming (HTML/JSX/XML)
        linkedEditing: langEditorSettings.linkedEditing ?? true,
        guides: {
          bracketPairs: langEditorSettings.guidesBracketPairs ?? true,
          bracketPairsHorizontal: true,
          highlightActiveBracketPair: true,
          indentation: langEditorSettings.guidesIndentation ?? true,
          highlightActiveIndentation: true,
        },
        // Layout
        padding: { top: 8, bottom: 8 },
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          useShadows: false,
        },
        // Multi-cursor
        multiCursorModifier: "alt",
        multiCursorMergeOverlapping: true,
        columnSelection: false, // Normal line selection (use Alt+Shift+drag for column/block selection)
        // Drag and drop
        dragAndDrop: true,
        // Copy
        copyWithSyntaxHighlighting: true,
        // Occurrences highlighting
        occurrencesHighlight: "singleFile",
        selectionHighlight: true,
        // Find widget
        find: {
          addExtraSpaceOnTop: false,
          seedSearchStringFromSelection: "selection",
          autoFindInSelection: "multiline",
        },
        // Suggest (autocomplete)
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: "on",
        // Links
        links: true,
        // Context menu
        contextmenu: true,
        // Sticky Scroll - shows parent scopes at top of editor (language-specific)
        stickyScroll: {
          enabled: langEditorSettings.stickyScrollEnabled ?? false,
          maxLineCount: 5,
        },
        // Inlay Hints - type hints, parameter names, return types
        inlayHints: {
          enabled: "on",
          fontSize: 12,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          padding: true,
        },
        // Code Lens - reference counts, test actions, implementations
        codeLens: settingsState.settings.editor.codeLens?.enabled ?? true,
        codeLensFontFamily:
          settingsState.settings.editor.codeLens?.fontFamily || undefined,
        codeLensFontSize:
          settingsState.settings.editor.codeLens?.fontSize || 12,
        // Format on Type - automatic formatting after trigger characters (language-specific)
        formatOnType: langEditorSettings.formatOnType ?? false,
        // Smart Select - enables intelligent selection expansion
        // Expansion order: Word → String → Expression → Statement → Block → Function → Class → File
        smartSelect: {
          selectLeadingAndTrailingWhitespace: false,
          selectSubwords: true,
        },
        // Unicode Highlighting - detect confusable characters (homoglyphs, invisible, bidi)
        unicodeHighlight: {
          ambiguousCharacters:
            settingsState.settings.editor.unicodeHighlight
              ?.ambiguousCharacters ?? true,
          invisibleCharacters:
            settingsState.settings.editor.unicodeHighlight
              ?.invisibleCharacters ?? true,
          nonBasicASCII:
            settingsState.settings.editor.unicodeHighlight?.nonBasicASCII ??
            false,
          includeComments:
            settingsState.settings.editor.unicodeHighlight?.includeComments ??
            "inUntrustedWorkspace",
          includeStrings:
            settingsState.settings.editor.unicodeHighlight?.includeStrings ??
            true,
          allowedCharacters: (settingsState.settings.editor.unicodeHighlight
            ?.allowedCharacters ?? {}) as Record<string, true>,
          allowedLocales: (settingsState.settings.editor.unicodeHighlight
            ?.allowedLocales ?? { _os: true, _vscode: true }) as Record<
            string,
            true
          >,
        },
        // Large file optimizations - use settings
        largeFileOptimizations:
          settingsState.settings.editor.largeFileOptimizations ?? true,
        maxTokenizationLineLength:
          settingsState.settings.editor.maxTokenizationLineLength ?? 20000,
      };

      // Get large file settings from user configuration
      const largeFileSettings: LargeFileSettings = {
        largeFileOptimizations:
          settingsState.settings.editor.largeFileOptimizations ?? true,
        maxTokenizationLineLength:
          settingsState.settings.editor.maxTokenizationLineLength ?? 20000,
      };

      // Apply large file-specific optimizations
      const editorOptions = monacoManager.getOptionsForFile(
        baseOptions,
        lineCount,
        largeFileSettings,
      );

      // Log large file optimizations if applied
      if (
        largeFileSettings.largeFileOptimizations &&
        lineCount > LARGE_FILE_THRESHOLDS.DISABLE_MINIMAP
      ) {
        console.debug(
          `[Monaco] Large file detected (${lineCount} lines), applying optimizations`,
        );
      }

      // Track if this is a new editor creation (for one-time setup)
      const isNewEditor = !editorInitialized;

      // Check if we can reuse the existing editor instance (swap model instead of recreate)
      if (editorInstance && editorInitialized) {
        // Reuse existing editor - just swap the model
        const model = monacoManager.getOrCreateModel(
          file.path,
          file.content,
          monacoLanguage,
        );
        editorInstance.setModel(model);
        console.debug(
          `[CodeEditor] Model swap: ${(performance.now() - modelStart).toFixed(1)}ms`,
        );

        // Apply large file optimizations to existing editor (using settings)
        monacoManager.updateEditorForFileSize(
          editorInstance,
          lineCount,
          largeFileSettings,
          langEditorSettings.minimapEnabled ?? true,
          langEditorSettings.foldingEnabled ?? true,
          langEditorSettings.bracketPairColorization ?? true,
        );

        // Update cursor style for vim mode
        editorInstance.updateOptions({ cursorStyle: initialCursorStyle });

        // Dispatch editor:file-ready event so other components know the editor is ready
        window.dispatchEvent(
          new CustomEvent("editor:file-ready", {
            detail: { filePath: file.path, fileId: file.id },
          }),
        );
      } else {
        // Create new editor instance
        editorInstance = monacoInstance!.editor.create(
          containerRef,
          editorOptions,
        );
        editorInitialized = true;

        // Set up the model using model caching
        const model = monacoManager.getOrCreateModel(
          file.path,
          file.content,
          monacoLanguage,
        );
        editorInstance.setModel(model);
        console.debug(
          `[CodeEditor] Editor creation: ${(performance.now() - modelStart).toFixed(1)}ms`,
        );
      }

      // Dispatch editor:file-ready event so other components know the editor is ready
      window.dispatchEvent(
        new CustomEvent("editor:file-ready", {
          detail: { filePath: file.path, fileId: file.id },
        }),
      );

      // Update signal for VimMode component
      setCurrentEditor(editorInstance);

      // === ONE-TIME SETUP (only on new editor creation) ===
      if (isNewEditor) {
        // Critical setup - must be synchronous
        // Initialize format on type settings from context
        updateFormatOnTypeSettings({
          enabled: settingsState.settings.editor.formatOnType ?? false,
          triggerCharacters: settingsState.settings.editor
            .formatOnTypeTriggerCharacters ?? [";", "}", "\n"],
        });

        // Initialize unicode highlight settings from context
        const unicodeSettings = settingsState.settings.editor.unicodeHighlight;
        if (unicodeSettings) {
          updateUnicodeHighlightSettings({
            enabled: unicodeSettings.enabled ?? true,
            invisibleCharacters: unicodeSettings.invisibleCharacters ?? true,
            ambiguousCharacters: unicodeSettings.ambiguousCharacters ?? true,
            nonBasicASCII: unicodeSettings.nonBasicASCII ?? false,
            includeComments:
              unicodeSettings.includeComments ?? "inUntrustedWorkspace",
            includeStrings: unicodeSettings.includeStrings ?? true,
            allowedCharacters: unicodeSettings.allowedCharacters ?? {},
            allowedLocales: unicodeSettings.allowedLocales ?? {
              _os: true,
              _vscode: true,
            },
          });
        }

        // Initialize linked editing state from settings
        updateLinkedEditingEnabled(
          settingsState.settings.editor.linkedEditing ?? true,
        );

        // Setup linked editing visual indicators and JSX self-closing conversion
        setupLinkedEditing(editorInstance, monacoInstance);

        // Initialize format-on-paste state from settings
        updateFormatOnPasteEnabled(
          settingsState.settings.editor.formatOnPaste ?? false,
        );

        // Setup format-on-paste functionality
        formatOnPasteDisposable = setupFormatOnPaste(
          editorInstance,
          monacoInstance,
          () => formatOnPasteEnabled,
        );

        // Setup multi-cursor actions
        setupMultiCursorActions(editorInstance, monacoInstance, file.id);

        // Setup event listeners for external commands
        setupEditorEventListeners(editorInstance, monacoInstance);

        // === DEFERRED ACTIONS REGISTRATION ===
        // Register editor actions asynchronously to avoid blocking UI on file open
        // Critical actions are registered sync, non-critical are deferred via requestIdleCallback
        const editor = editorInstance;
        const monaco = monacoInstance;

        // Disable Monaco's built-in command palette completely (critical - do sync)
        const openIDECommandPalette = () => {
          window.dispatchEvent(new CustomEvent("command-palette:toggle"));
        };

        // Intercept Ctrl+Shift+P (critical)
        editor.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
          openIDECommandPalette,
        );

        // Intercept F1 (critical)
        editor.addCommand(monaco.KeyCode.F1, openIDECommandPalette);

        // Override Monaco's internal quickCommand trigger (critical)
        const originalTrigger = editorInstance.trigger.bind(editorInstance);
        editorInstance.trigger = (
          source: string,
          handlerId: string,
          payload: any,
        ) => {
          if (handlerId === "editor.action.quickCommand") {
            openIDECommandPalette();
            return;
          }
          return originalTrigger(source, handlerId, payload);
        };

        // Override getAction to redirect quickCommand to our palette (critical)
        const originalGetAction = editorInstance.getAction.bind(editorInstance);
        editorInstance.getAction = (
          id: string,
        ): Monaco.editor.IEditorAction | null => {
          if (id === "editor.action.quickCommand") {
            return {
              id: "editor.action.quickCommand",
              label: "Command Palette",
              alias: "",
              isSupported: () => true,
              run: openIDECommandPalette,
            } as Monaco.editor.IEditorAction;
          }
          return originalGetAction(id);
        };

        // Add comment toggle action (Ctrl+/) - critical for daily use
        editorInstance.addAction({
          id: "toggle-line-comment",
          label: "Toggle Line Comment",
          keybindings: [
            monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyCode.Slash,
          ],
          run: (ed) => {
            ed.trigger("keyboard", "editor.action.commentLine", null);
          },
        });

        // Add block comment toggle (Ctrl+Shift+/) - critical for daily use
        editorInstance.addAction({
          id: "toggle-block-comment",
          label: "Toggle Block Comment",
          keybindings: [
            monacoInstance!.KeyMod.CtrlCmd |
              monacoInstance!.KeyMod.Shift |
              monacoInstance!.KeyCode.Slash,
          ],
          run: (ed) => {
            ed.trigger("keyboard", "editor.action.blockComment", null);
          },
        });

        // === DEFER REMAINING ACTIONS TO NEXT FRAME ===
        // This prevents blocking the UI when opening files in large repos
        const deferredSetup = () => {
          // Check if editor is still valid (user may have switched files)
          if (!editorInstance || editorInstance.getModel() === null) return;
          const ed = editorInstance;
          const mon = monacoInstance;
          if (!ed || !mon) return;

          // Add toggle word wrap action
          editorInstance.addAction({
            id: "toggle-word-wrap",
            label: "Toggle Word Wrap",
            keybindings: [
              monacoInstance!.KeyMod.Alt | monacoInstance!.KeyCode.KeyZ,
            ],
            run: (ed) => {
              if (!monacoInstance) return;
              const currentWrap = ed.getOption(
                monacoInstance!.editor.EditorOption.wordWrap,
              );
              ed.updateOptions({
                wordWrap: currentWrap === "off" ? "on" : "off",
              });
            },
          });

          // Add toggle minimap action
          editorInstance.addAction({
            id: "toggle-minimap",
            label: "Toggle Minimap",
            run: (ed) => {
              if (!monacoInstance) return;
              const currentOption = ed.getOption(
                monacoInstance!.editor.EditorOption.minimap,
              );
              ed.updateOptions({
                minimap: { enabled: !currentOption.enabled },
              });
            },
          });

          // Add toggle sticky scroll action (Ctrl+Shift+S)
          editorInstance.addAction({
            id: "toggle-sticky-scroll",
            label: "Toggle Sticky Scroll",
            keybindings: [
              monacoInstance!.KeyMod.CtrlCmd |
                monacoInstance!.KeyMod.Shift |
                monacoInstance!.KeyCode.KeyY,
            ],
            run: (ed) => {
              if (!monacoInstance) return;
              const currentOption = ed.getOption(
                monacoInstance!.editor.EditorOption.stickyScroll,
              );
              const newEnabled = !currentOption.enabled;
              ed.updateOptions({
                stickyScroll: { enabled: newEnabled, maxLineCount: 5 },
              });
              // Persist the setting
              updateEditorSetting("stickyScrollEnabled", newEnabled);
            },
          });

          // Add toggle bracket pair colorization action
          editorInstance.addAction({
            id: "toggle-bracket-colorization",
            label: "Toggle Bracket Pair Colorization",
            run: (ed) => {
              if (!monacoInstance) return;
              const currentOption = ed.getOption(
                monacoInstance!.editor.EditorOption.bracketPairColorization,
              );
              const newEnabled = !currentOption.enabled;
              ed.updateOptions({
                bracketPairColorization: {
                  enabled: newEnabled,
                  independentColorPoolPerBracketType: true,
                },
              });
              // Persist the setting
              updateEditorSetting("bracketPairColorization", newEnabled);
            },
          });

          // Add toggle bracket pair guides action
          editorInstance.addAction({
            id: "toggle-bracket-guides",
            label: "Toggle Bracket Pair Guides",
            run: (ed) => {
              if (!monacoInstance) return;
              const currentOption = ed.getOption(
                monacoInstance!.editor.EditorOption.guides,
              );
              const newEnabled = !currentOption.bracketPairs;
              ed.updateOptions({
                guides: {
                  ...currentOption,
                  bracketPairs: newEnabled,
                  bracketPairsHorizontal: newEnabled,
                },
              });
              // Persist the setting
              updateEditorSetting("guidesBracketPairs", newEnabled);
            },
          });

          // Add toggle indentation guides action
          editorInstance.addAction({
            id: "toggle-indentation-guides",
            label: "Toggle Indentation Guides",
            run: (ed) => {
              if (!monacoInstance) return;
              const currentOption = ed.getOption(
                monacoInstance!.editor.EditorOption.guides,
              );
              const newEnabled = !currentOption.indentation;
              ed.updateOptions({
                guides: {
                  ...currentOption,
                  indentation: newEnabled,
                  highlightActiveIndentation: newEnabled,
                },
              });
              // Persist the setting
              updateEditorSetting("guidesIndentation", newEnabled);
            },
          });

          // Add toggle inlay hints action (Ctrl+Alt+I)
          editorInstance.addAction({
            id: "toggle-inlay-hints",
            label: "Toggle Inlay Hints",
            keybindings: [
              monacoInstance!.KeyMod.CtrlCmd |
                monacoInstance!.KeyMod.Alt |
                monacoInstance!.KeyCode.KeyI,
            ],
            run: (ed) => {
              if (!monacoInstance) return;
              const currentOption = ed.getOption(
                monacoInstance!.editor.EditorOption.inlayHints,
              );
              const currentEnabled = currentOption.enabled;
              // Toggle between 'on' and 'off'
              const newEnabled: "on" | "off" =
                currentEnabled === "on" ? "off" : "on";
              ed.updateOptions({
                inlayHints: {
                  ...currentOption,
                  enabled: newEnabled,
                },
              });
              // Update global settings state
              updateInlayHintSettings({ enabled: newEnabled });
            },
          });

          // Add toggle inlay hints parameter names action
          editorInstance.addAction({
            id: "toggle-inlay-hints-parameter-names",
            label: "Toggle Inlay Hints: Parameter Names",
            run: () => {
              const newValue = !getInlayHintSettings().showParameterNames;
              updateInlayHintSettings({ showParameterNames: newValue });
            },
          });

          // Add toggle inlay hints type hints action
          editorInstance.addAction({
            id: "toggle-inlay-hints-type-hints",
            label: "Toggle Inlay Hints: Type Hints",
            run: () => {
              const newValue = !getInlayHintSettings().showTypeHints;
              updateInlayHintSettings({ showTypeHints: newValue });
            },
          });

          // Add toggle unicode highlight action (Ctrl+Shift+U)
          editorInstance.addAction({
            id: "toggle-unicode-highlight",
            label: "Toggle Unicode Highlighting",
            keybindings: [
              monacoInstance!.KeyMod.CtrlCmd |
                monacoInstance!.KeyMod.Shift |
                monacoInstance!.KeyCode.KeyU,
            ],
            run: (ed) => {
              if (!monacoInstance) return;
              const newEnabled = !getUnicodeHighlightSettings().enabled;
              updateUnicodeHighlightSettings({ enabled: newEnabled });
              ed.updateOptions({
                unicodeHighlight: {
                  ambiguousCharacters: newEnabled
                    ? getUnicodeHighlightSettings().ambiguousCharacters
                    : false,
                  invisibleCharacters: newEnabled
                    ? getUnicodeHighlightSettings().invisibleCharacters
                    : false,
                  nonBasicASCII: newEnabled
                    ? getUnicodeHighlightSettings().nonBasicASCII
                    : false,
                },
              });
            },
          });

          // Add toggle unicode highlight invisible characters action
          editorInstance.addAction({
            id: "toggle-unicode-highlight-invisible",
            label: "Toggle Unicode Highlight: Invisible Characters",
            run: (ed) => {
              if (!monacoInstance) return;
              const newValue =
                !getUnicodeHighlightSettings().invisibleCharacters;
              updateUnicodeHighlightSettings({ invisibleCharacters: newValue });
              ed.updateOptions({
                unicodeHighlight: { invisibleCharacters: newValue },
              });
            },
          });

          // Add toggle unicode highlight ambiguous characters action
          editorInstance.addAction({
            id: "toggle-unicode-highlight-ambiguous",
            label:
              "Toggle Unicode Highlight: Ambiguous Characters (Homoglyphs)",
            run: (ed) => {
              if (!monacoInstance) return;
              const newValue =
                !getUnicodeHighlightSettings().ambiguousCharacters;
              updateUnicodeHighlightSettings({ ambiguousCharacters: newValue });
              ed.updateOptions({
                unicodeHighlight: { ambiguousCharacters: newValue },
              });
            },
          });

          // Add format document action (Shift+Alt+F)
          editorInstance.addAction({
            id: "format-document",
            label: "Format Document",
            keybindings: [
              monacoInstance!.KeyMod.Shift |
                monacoInstance!.KeyMod.Alt |
                monacoInstance!.KeyCode.KeyF,
            ],
            run: (ed) => {
              ed.trigger("keyboard", "editor.action.formatDocument", null);
            },
          });

          // Add toggle format-on-paste action (Ctrl+Shift+V)
          editorInstance.addAction({
            id: "toggle-format-on-paste",
            label: "Toggle Format on Paste",
            keybindings: [
              monacoInstance!.KeyMod.CtrlCmd |
                monacoInstance!.KeyMod.Shift |
                monacoInstance!.KeyCode.KeyV,
            ],
            run: () => {
              const newEnabled = !formatOnPasteEnabled;
              updateFormatOnPasteEnabled(newEnabled);
              // Persist the setting
              updateEditorSetting("formatOnPaste", newEnabled);
              // Emit event for settings sync
              window.dispatchEvent(
                new CustomEvent("editor-format-on-paste-changed", {
                  detail: { enabled: newEnabled },
                }),
              );
            },
          });

          // Add indent/outdent actions (Tab and Shift+Tab are built-in but let's ensure they work)
          editorInstance.addAction({
            id: "indent-lines",
            label: "Indent Lines",
            run: (ed) => {
              ed.trigger("keyboard", "editor.action.indentLines", null);
            },
          });

          editorInstance.addAction({
            id: "outdent-lines",
            label: "Outdent Lines",
            run: (ed) => {
              ed.trigger("keyboard", "editor.action.outdentLines", null);
            },
          });

          // Add Join Lines action (Ctrl+J)
          editorInstance.addAction({
            id: "editor.action.joinLines",
            label: "Join Lines",
            keybindings: [
              monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyCode.KeyJ,
            ],
            run: (editor) => {
              const model = editor.getModel();
              if (!model) return;

              const selections = editor.getSelections();
              if (!selections) return;

              editor.pushUndoStop();

              const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [];

              for (const selection of selections) {
                const startLine = selection.startLineNumber;
                const endLine =
                  selection.endLineNumber === startLine
                    ? startLine + 1
                    : selection.endLineNumber;

                // Join all lines in range
                for (
                  let line = startLine;
                  line < endLine && line < model.getLineCount();
                  line++
                ) {
                  const currentLineEnd = model.getLineMaxColumn(line);
                  const nextLineStart = model.getLineFirstNonWhitespaceColumn(
                    line + 1,
                  );

                  // Remove newline and leading whitespace of next line, replace with single space
                  edits.push({
                    range: {
                      startLineNumber: line,
                      startColumn: currentLineEnd,
                      endLineNumber: line + 1,
                      endColumn: nextLineStart || 1,
                    },
                    text: " ",
                  });
                }
              }

              editor.executeEdits("joinLines", edits);
              editor.pushUndoStop();
            },
          });

          // Add toggle coverage decorations action (Ctrl+Shift+C)
          editorInstance.addAction({
            id: "toggle-coverage-decorations",
            label: "Toggle Test Coverage Decorations",
            keybindings: [
              monacoInstance!.KeyMod.CtrlCmd |
                monacoInstance!.KeyMod.Shift |
                monacoInstance!.KeyCode.KeyC,
            ],
            run: () => {
              testing.toggleCoverageDecorations();
            },
          });

          // Add toggle inline blame action (Ctrl+Alt+B)
          editorInstance.addAction({
            id: "toggle-inline-blame",
            label: "Toggle Inline Git Blame",
            keybindings: [
              monacoInstance!.KeyMod.CtrlCmd |
                monacoInstance!.KeyMod.Alt |
                monacoInstance!.KeyCode.KeyB,
            ],
            run: () => {
              toggleInlineBlame();
            },
          });

          // Add inline blame mode actions
          editorInstance.addAction({
            id: "inline-blame-current-line",
            label: "Inline Blame: Show Current Line Only",
            run: () => {
              setInlineBlameMode("currentLine");
            },
          });

          editorInstance.addAction({
            id: "inline-blame-all-lines",
            label: "Inline Blame: Show All Lines",
            run: () => {
              setInlineBlameMode("allLines");
            },
          });

          editorInstance.addAction({
            id: "inline-blame-off",
            label: "Inline Blame: Turn Off",
            run: () => {
              setInlineBlameMode("off");
            },
          });

          // Fold All
          editorInstance.addAction({
            id: "editor.foldAll",
            label: "Fold All",
            keybindings: [
              monacoInstance!.KeyMod.CtrlCmd |
                monacoInstance!.KeyMod.Shift |
                monacoInstance!.KeyCode.BracketLeft,
            ],
            run: (editor) => editor.trigger("keyboard", "editor.foldAll", null),
          });

          // Unfold All
          editorInstance.addAction({
            id: "editor.unfoldAll",
            label: "Unfold All",
            keybindings: [
              monacoInstance!.KeyMod.CtrlCmd |
                monacoInstance!.KeyMod.Shift |
                monacoInstance!.KeyCode.BracketRight,
            ],
            run: (editor) =>
              editor.trigger("keyboard", "editor.unfoldAll", null),
          });

          // Toggle Fold
          editorInstance.addAction({
            id: "editor.toggleFold",
            label: "Toggle Fold",
            keybindings: [
              monacoInstance!.KeyMod.CtrlCmd |
                monacoInstance!.KeyCode.BracketLeft,
            ],
            run: (editor) =>
              editor.trigger("keyboard", "editor.toggleFold", null),
          });

          // Fold Level 1-7
          for (let level = 1; level <= 7; level++) {
            editorInstance.addAction({
              id: `editor.foldLevel${level}`,
              label: `Fold Level ${level}`,
              keybindings: [
                monacoInstance!.KeyMod.CtrlCmd |
                  monacoInstance!.KeyCode[
                    `Digit${level}` as keyof typeof Monaco.KeyCode
                  ],
              ],
              run: (editor) =>
                editor.trigger("keyboard", `editor.foldLevel${level}`, null),
            });
          }

          // Fold All Block Comments
          editorInstance.addAction({
            id: "editor.foldAllBlockComments",
            label: "Fold All Block Comments",
            run: (editor) =>
              editor.trigger("keyboard", "editor.foldAllBlockComments", null),
          });

          // Fold All Regions
          editorInstance.addAction({
            id: "editor.foldAllMarkerRegions",
            label: "Fold All Regions",
            run: (editor) =>
              editor.trigger("keyboard", "editor.foldAllMarkerRegions", null),
          });

          // Unfold All Regions
          editorInstance.addAction({
            id: "editor.unfoldAllMarkerRegions",
            label: "Unfold All Regions",
            run: (editor) =>
              editor.trigger("keyboard", "editor.unfoldAllMarkerRegions", null),
          });

          // Fold Recursively
          editorInstance.addAction({
            id: "editor.foldRecursively",
            label: "Fold Recursively",
            run: (editor) =>
              editor.trigger("keyboard", "editor.foldRecursively", null),
          });

          // Unfold Recursively
          editorInstance.addAction({
            id: "editor.unfoldRecursively",
            label: "Unfold Recursively",
            run: (editor) =>
              editor.trigger("keyboard", "editor.unfoldRecursively", null),
          });

          // Add Peek Definition action (Alt+F12)
          editorInstance.addAction({
            id: "editor.action.peekDefinition",
            label: "Peek Definition",
            keybindings: [
              monacoInstance!.KeyMod.Alt | monacoInstance!.KeyCode.F12,
            ],
            run: (ed) => {
              ed.trigger("keyboard", "editor.action.peekDefinition", null);
            },
          });

          // Add Peek References action (Shift+F12) - uses LSP getReferences and shows inline peek
          editorInstance.addAction({
            id: "editor.action.referenceSearch.trigger",
            label: "Peek References",
            keybindings: [
              monacoInstance!.KeyMod.Shift | monacoInstance!.KeyCode.F12,
            ],
            run: async (ed) => {
              const model = ed.getModel();
              const position = ed.getPosition();
              if (!model || !position) return;

              const uri = model.uri.toString();
              const filePath = uri.replace("file://", "");
              const languageId = model.getLanguageId();

              // Get symbol name under cursor
              const wordInfo = model.getWordAtPosition(position);
              const symbolName = wordInfo?.word || "";

              try {
                // Call LSP references via multi-provider
                const result = await invoke<{
                  locations: Array<{
                    uri: string;
                    range: {
                      start: { line: number; character: number };
                      end: { line: number; character: number };
                    };
                  }>;
                }>("lsp_multi_references", {
                  language: languageId,
                  params: {
                    uri: filePath,
                    position: {
                      line: position.lineNumber - 1,
                      character: position.column - 1,
                    },
                  },
                });

                if (
                  !result ||
                  !result.locations ||
                  result.locations.length === 0
                ) {
                  // Fallback: try the standard lsp_references
                  const standardResult = await invoke<{
                    locations: Array<{
                      uri: string;
                      range: {
                        start: { line: number; character: number };
                        end: { line: number; character: number };
                      };
                    }>;
                  }>("lsp_references", {
                    serverId: languageId,
                    params: {
                      uri: filePath,
                      position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                      },
                    },
                  });

                  if (
                    !standardResult ||
                    !standardResult.locations ||
                    standardResult.locations.length === 0
                  ) {
                    console.debug("No references found for peek");
                    return;
                  }

                  // Convert to Location format for showPeekReferences
                  const locations = standardResult.locations.map((loc) => ({
                    uri: loc.uri.startsWith("file://")
                      ? loc.uri
                      : `file://${loc.uri}`,
                    range: {
                      start: {
                        line: loc.range.start.line,
                        character: loc.range.start.character,
                      },
                      end: {
                        line: loc.range.end.line,
                        character: loc.range.end.character,
                      },
                    },
                  }));

                  showPeekReferences(locations, symbolName, position, uri);
                  return;
                }

                // Convert to Location format for showPeekReferences
                const locations = result.locations.map((loc) => ({
                  uri: loc.uri.startsWith("file://")
                    ? loc.uri
                    : `file://${loc.uri}`,
                  range: {
                    start: {
                      line: loc.range.start.line,
                      character: loc.range.start.character,
                    },
                    end: {
                      line: loc.range.end.line,
                      character: loc.range.end.character,
                    },
                  },
                }));

                showPeekReferences(locations, symbolName, position, uri);
              } catch (error) {
                console.error("Failed to get references for peek:", error);
              }
            },
          });

          // Add Find All References action (Shift+Alt+F12) - uses LSP getReferences and shows panel
          editorInstance.addAction({
            id: "editor.action.findAllReferences",
            label: "Find All References",
            keybindings: [
              monacoInstance!.KeyMod.Shift |
                monacoInstance!.KeyMod.Alt |
                monacoInstance!.KeyCode.F12,
            ],
            run: async (ed) => {
              const model = ed.getModel();
              const position = ed.getPosition();
              if (!model || !position) return;

              const uri = model.uri.toString();
              const filePath = uri.replace("file://", "");
              const languageId = model.getLanguageId();

              // Get symbol name under cursor
              const wordInfo = model.getWordAtPosition(position);
              const symbolName = wordInfo?.word || "";

              try {
                // Call LSP references via multi-provider
                const result = await invoke<{
                  locations: Array<{
                    uri: string;
                    range: {
                      start: { line: number; character: number };
                      end: { line: number; character: number };
                    };
                  }>;
                }>("lsp_multi_references", {
                  language: languageId,
                  params: {
                    uri: filePath,
                    position: {
                      line: position.lineNumber - 1,
                      character: position.column - 1,
                    },
                  },
                });

                if (
                  !result ||
                  !result.locations ||
                  result.locations.length === 0
                ) {
                  // Fallback: try the standard lsp_references
                  const standardResult = await invoke<{
                    locations: Array<{
                      uri: string;
                      range: {
                        start: { line: number; character: number };
                        end: { line: number; character: number };
                      };
                    }>;
                  }>("lsp_references", {
                    serverId: languageId,
                    params: {
                      uri: filePath,
                      position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                      },
                    },
                  });

                  if (
                    !standardResult ||
                    !standardResult.locations ||
                    standardResult.locations.length === 0
                  ) {
                    console.debug("No references found");
                    return;
                  }

                  // Convert to Location format for showReferencesPanel
                  const locations = standardResult.locations.map((loc) => ({
                    uri: loc.uri.startsWith("file://")
                      ? loc.uri
                      : `file://${loc.uri}`,
                    range: {
                      start: {
                        line: loc.range.start.line,
                        character: loc.range.start.character,
                      },
                      end: {
                        line: loc.range.end.line,
                        character: loc.range.end.character,
                      },
                    },
                  }));

                  showReferencesPanel(locations, symbolName, uri, {
                    line: position.lineNumber - 1,
                    character: position.column - 1,
                  });
                  return;
                }

                // Convert to Location format for showReferencesPanel
                const locations = result.locations.map((loc) => ({
                  uri: loc.uri.startsWith("file://")
                    ? loc.uri
                    : `file://${loc.uri}`,
                  range: {
                    start: {
                      line: loc.range.start.line,
                      character: loc.range.start.character,
                    },
                    end: {
                      line: loc.range.end.line,
                      character: loc.range.end.character,
                    },
                  },
                }));

                showReferencesPanel(locations, symbolName, uri, {
                  line: position.lineNumber - 1,
                  character: position.column - 1,
                });
              } catch (error) {
                console.error("Failed to find all references:", error);
              }
            },
          });

          // Add Peek Implementation action (Ctrl+Shift+F12)
          editorInstance.addAction({
            id: "editor.action.peekImplementation",
            label: "Peek Implementation",
            keybindings: [
              monacoInstance!.KeyMod.CtrlCmd |
                monacoInstance!.KeyMod.Shift |
                monacoInstance!.KeyCode.F12,
            ],
            run: (ed) => {
              ed.trigger("keyboard", "editor.action.peekImplementation", null);
            },
          });

          // Initialize inline blame manager (one-time)
          if (!inlineBlameManager) {
            inlineBlameManager = new InlineBlameManager();
          }

          editorInstance.onDidChangeModelContent(() => {
            if (!editorInstance) return;
            const currentFile = activeFile();
            if (!currentFile) return;
            const content = editorInstance.getValue();
            updateFileContent(currentFile.id, content);
          });

          editorInstance.onDidChangeCursorPosition((e) => {
            if (!editorInstance) return;
            const selections = editorInstance.getSelections() || [];
            const cursorCount = selections.length;
            const selectionCount = selections.filter(
              (s) => !s.isEmpty(),
            ).length;

            updateCursorInfo(cursorCount, selectionCount);

            const position = e.position;
            const currentFile = activeFile();
            window.dispatchEvent(
              new CustomEvent("editor-cursor-change", {
                detail: {
                  line: position.lineNumber,
                  column: position.column,
                  cursorCount,
                  selectionCount,
                },
              }),
            );

            // Dispatch cursor changed event for navigation history tracking
            // Only track significant cursor moves (not programmatic moves from navigation)
            if (
              currentFile &&
              monacoInstance &&
              e.reason === monacoInstance!.editor.CursorChangeReason.Explicit
            ) {
              window.dispatchEvent(
                new CustomEvent("editor:cursor-changed", {
                  detail: {
                    filePath: currentFile.path,
                    line: position.lineNumber,
                    column: position.column,
                  },
                }),
              );
            }
          });

          editorInstance.onDidChangeCursorSelection(() => {
            if (!editorInstance) return;
            const selections = editorInstance.getSelections() || [];
            const cursorCount = selections.length;
            const selectionCount = selections.filter(
              (s) => !s.isEmpty(),
            ).length;
            updateCursorInfo(cursorCount, selectionCount);
          });

          editorInstance.addCommand(
            monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyCode.KeyS,
            () => {
              const currentFile = activeFile();
              if (currentFile) saveFile(currentFile.id);
            },
          );

          // Emmet abbreviation expansion on Tab
          editorInstance.addCommand(
            monacoInstance!.KeyCode.Tab,
            () => {
              const position = editorInstance!.getPosition();
              if (!position) {
                editorInstance!.trigger("keyboard", "tab", null);
                return;
              }
              const model = editorInstance!.getModel();
              if (!model) {
                editorInstance!.trigger("keyboard", "tab", null);
                return;
              }
              const language = model.getLanguageId();
              const range = getAbbreviationRange(
                model,
                position,
                monacoInstance!,
              );
              if (!range) {
                editorInstance!.trigger("keyboard", "tab", null);
                return;
              }
              const abbreviation = model.getValueInRange(range);
              const expanded = expandEmmetAbbreviation(abbreviation, language);
              if (expanded) {
                editorInstance!.executeEdits("emmet", [
                  { range, text: expanded },
                ]);
              } else {
                editorInstance!.trigger("keyboard", "tab", null);
              }
            },
            "editorTextFocus && !suggestWidgetVisible && !inSnippetMode",
          );

          // F2 - Rename Symbol (triggers RenameWidget)
          editorInstance.addAction({
            id: "editor.action.rename",
            label: "Rename Symbol",
            keybindings: [monacoInstance!.KeyCode.F2],
            run: () => {
              // Dispatch event to trigger RenameWidget
              showRenameWidget();
            },
          });
        }; // End of deferredSetup function

        // Schedule deferred setup to run after UI has painted
        if ("requestIdleCallback" in window) {
          (
            window as Window & {
              requestIdleCallback: (
                cb: () => void,
                opts?: { timeout: number },
              ) => number;
            }
          ).requestIdleCallback(deferredSetup, { timeout: 150 });
        } else {
          setTimeout(deferredSetup, 0);
        }
      } // End of isNewEditor block

      // === PER-FILE-CHANGE SETUP ===
      // Initialize inline blame with current mode and file (must run on each file change)
      if (file && inlineBlameManager) {
        inlineBlameManager.initialize(
          editorInstance,
          monacoInstance,
          file.path,
          getInlineBlameMode(),
          true, // showMessage
          50, // maxMessageLength
        );
      }
      console.debug(
        `[CodeEditor] Effect TOTAL: ${(performance.now() - effectStart).toFixed(1)}ms`,
      );
    }
  });

  // Setup event listeners for external commands (goto-line, buffer-search-goto, editor-command)
  function setupEditorEventListeners(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ) {
    // Clear previous event listeners
    eventCleanupFns.forEach((fn) => fn());
    eventCleanupFns.length = 0;

    // Handle goto-line event (from GoToLine dialog and ProjectSearch)
    const handleGotoLine = (
      e: CustomEvent<{ line: number; column?: number }>,
    ) => {
      const { line, column = 1 } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    // Handle editor:goto-line event (from ProjectSymbols)
    const handleEditorGotoLine = (
      e: CustomEvent<{ line: number; column?: number }>,
    ) => {
      const { line, column = 1 } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    // Handle outline:navigate event (from OutlinePanel symbol navigation)
    const handleOutlineNavigate = (
      e: CustomEvent<{ fileId: string; line: number; column: number }>,
    ) => {
      const currentFile = activeFile();
      if (!currentFile || e.detail.fileId !== currentFile.id) return;

      const { line, column } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    // Handle buffer-search-goto event (from BufferSearch)
    const handleBufferSearchGoto = (
      e: CustomEvent<{ line: number; start: number; end: number }>,
    ) => {
      const { line, start, end } = e.detail;
      const model = editor.getModel();
      if (!model) return;

      // Convert absolute offsets to line/column positions
      const startPos = model.getPositionAt(start);
      const endPos = model.getPositionAt(end);

      // Select the matched text
      editor.setSelection({
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
      });

      editor.revealLineInCenter(line);
      editor.focus();
    };

    // Handle buffer-search:get-selection event (from BufferSearch for Replace in Selection)
    const handleBufferSearchGetSelection = () => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        window.dispatchEvent(
          new CustomEvent("buffer-search:selection-response", {
            detail: {
              selection: {
                startLine: selection.startLineNumber,
                startColumn: selection.startColumn,
                endLine: selection.endLineNumber,
                endColumn: selection.endColumn,
              },
            },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("buffer-search:selection-response", {
            detail: { selection: null },
          }),
        );
      }
    };

    // Handle editor:get-selection-for-terminal event (from TerminalsContext for Run Selection)
    const handleGetSelectionForTerminal = () => {
      const model = editor.getModel();
      const selection = editor.getSelection();
      if (model && selection && !selection.isEmpty()) {
        const selectedText = model.getValueInRange(selection);
        window.dispatchEvent(
          new CustomEvent("editor:selection-for-terminal", {
            detail: { selection: selectedText },
          }),
        );
      }
    };

    // Handle editor:get-active-file-for-terminal event (from TerminalsContext for Run File)
    const handleGetActiveFileForTerminal = () => {
      const currentFile = activeFile();
      if (currentFile?.path) {
        window.dispatchEvent(
          new CustomEvent("editor:active-file-for-terminal", {
            detail: { filePath: currentFile.path },
          }),
        );
      }
    };

    // Handle editor-command events (from CommandContext and CommandPalette)
    const handleEditorCommand = async (e: CustomEvent<{ command: string }>) => {
      const { command } = e.detail;

      // Handle smart select commands specially with our SmartSelectManager
      if (command === "expand-selection") {
        await smartSelectManager.expandSelection(editor, monaco);
        editor.focus();
        return;
      }

      if (command === "shrink-selection") {
        smartSelectManager.shrinkSelection(editor, monaco);
        editor.focus();
        return;
      }

      // Handle custom text transform commands
      const customTransformCommands = [
        "transform-to-snakecase",
        "transform-to-camelcase",
        "transform-to-pascalcase",
        "transform-to-kebabcase",
        "transform-to-constantcase",
      ];

      if (customTransformCommands.includes(command)) {
        const action = editor.getAction(command);
        if (action) {
          action.run();
          editor.focus();
          return;
        }
      }

      // Handle sort/line manipulation commands
      if (
        command === "sort-lines-ascending" ||
        command === "sort-lines-descending" ||
        command === "sort-lines-ascending-case-insensitive" ||
        command === "sort-lines-descending-case-insensitive" ||
        command === "sort-lines-natural" ||
        command === "sort-lines-by-length" ||
        command === "reverse-lines" ||
        command === "shuffle-lines" ||
        command === "remove-duplicate-lines"
      ) {
        const model = editor.getModel();
        if (!model) return;

        const selection = editor.getSelection();
        const startLine = selection?.startLineNumber || 1;
        const endLine = selection?.endLineNumber || model.getLineCount();

        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
          lines.push(model.getLineContent(i));
        }

        let sortedLines: string[];

        switch (command) {
          case "sort-lines-ascending":
            sortedLines = [...lines].sort((a, b) => a.localeCompare(b));
            break;
          case "sort-lines-descending":
            sortedLines = [...lines].sort((a, b) => b.localeCompare(a));
            break;
          case "sort-lines-ascending-case-insensitive":
            sortedLines = [...lines].sort((a, b) =>
              a.toLowerCase().localeCompare(b.toLowerCase()),
            );
            break;
          case "sort-lines-descending-case-insensitive":
            sortedLines = [...lines].sort((a, b) =>
              b.toLowerCase().localeCompare(a.toLowerCase()),
            );
            break;
          case "sort-lines-natural":
            sortedLines = [...lines].sort((a, b) =>
              a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: "base",
              }),
            );
            break;
          case "sort-lines-by-length":
            sortedLines = [...lines].sort((a, b) => a.length - b.length);
            break;
          case "reverse-lines":
            sortedLines = [...lines].reverse();
            break;
          case "shuffle-lines":
            sortedLines = [...lines];
            for (let i = sortedLines.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [sortedLines[i], sortedLines[j]] = [
                sortedLines[j],
                sortedLines[i],
              ];
            }
            break;
          case "remove-duplicate-lines": {
            const seen = new Set<string>();
            sortedLines = lines.filter((line) => {
              if (seen.has(line)) {
                return false;
              }
              seen.add(line);
              return true;
            });
            break;
          }
          default:
            sortedLines = lines;
        }

        editor.pushUndoStop();
        editor.executeEdits("sortLines", [
          {
            range: {
              startLineNumber: startLine,
              startColumn: 1,
              endLineNumber: endLine,
              endColumn: model.getLineMaxColumn(endLine),
            },
            text: sortedLines.join("\n"),
          },
        ]);
        editor.pushUndoStop();
        editor.focus();
        return;
      }

      const commandMap: Record<string, string> = {
        // Edit menu commands (undo, redo, clipboard operations)
        undo: "undo",
        redo: "redo",
        cut: "editor.action.clipboardCutAction",
        copy: "editor.action.clipboardCopyAction",
        paste: "editor.action.clipboardPasteAction",
        "select-all": "editor.action.selectAll",
        // Multi-cursor commands
        "add-cursor-above": "editor.action.insertCursorAbove",
        "add-cursor-below": "editor.action.insertCursorBelow",
        "select-all-occurrences": "editor.action.selectHighlights",
        "add-selection-to-next-find-match":
          "editor.action.addSelectionToNextFindMatch",
        "add-cursors-to-line-ends":
          "editor.action.insertCursorAtEndOfEachLineSelected",
        "undo-cursor": "cursorUndo",
        "duplicate-selection": "editor.action.copyLinesDownAction",
        "move-line-up": "editor.action.moveLinesUpAction",
        "move-line-down": "editor.action.moveLinesDownAction",
        "copy-line-up": "editor.action.copyLinesUpAction",
        "copy-line-down": "editor.action.copyLinesDownAction",
        "select-line": "expandLineSelection",
        "transform-to-uppercase": "editor.action.transformToUppercase",
        "transform-to-lowercase": "editor.action.transformToLowercase",
        "transform-to-titlecase": "editor.action.transformToTitlecase",
        "toggle-line-comment": "editor.action.commentLine",
        "toggle-block-comment": "editor.action.blockComment",
        "format-document": "editor.action.formatDocument",
        "indent-lines": "editor.action.indentLines",
        "outdent-lines": "editor.action.outdentLines",
        // Folding commands
        "fold-all": "editor.foldAll",
        "unfold-all": "editor.unfoldAll",
        "toggle-fold": "editor.toggleFold",
        "fold-level-1": "editor.foldLevel1",
        "fold-level-2": "editor.foldLevel2",
        "fold-level-3": "editor.foldLevel3",
        "fold-level-4": "editor.foldLevel4",
        "fold-level-5": "editor.foldLevel5",
        "fold-level-6": "editor.foldLevel6",
        "fold-level-7": "editor.foldLevel7",
        "fold-all-block-comments": "editor.foldAllBlockComments",
        "fold-all-regions": "editor.foldAllMarkerRegions",
        "unfold-all-regions": "editor.unfoldAllMarkerRegions",
        "fold-recursively": "editor.foldRecursively",
        "unfold-recursively": "editor.unfoldRecursively",
        // Bracket navigation commands
        "jump-to-bracket": "editor.action.jumpToBracket",
        "select-to-bracket": "editor.action.selectToBracket",
        // Peek commands for inline code navigation
        "peek-definition": "editor.action.peekDefinition",
        "peek-references": "editor.action.referenceSearch.trigger",
        "peek-implementation": "editor.action.peekImplementation",
        // Go to commands
        "go-to-implementation": "editor.action.goToImplementation",
        // Transpose commands
        "transpose-characters": "editor.action.transposeLetters",
        // Delete word part commands
        "delete-word-part-left": "deleteWordPartLeft",
        "delete-word-part-right": "deleteWordPartRight",
        // In-place replace commands
        "in-place-replace-up": "editor.action.inPlaceReplace.up",
        "in-place-replace-down": "editor.action.inPlaceReplace.down",
        // Linked editing
        "toggle-linked-editing": "editor.action.linkedEditing",
        // Hover and suggestions
        "show-hover": "editor.action.showHover",
        "trigger-suggest": "editor.action.triggerSuggest",
        "trigger-parameter-hints": "editor.action.triggerParameterHints",
        // Smart select (expand/shrink selection)
        "smart-select-expand": "editor.action.smartSelect.expand",
        "smart-select-shrink": "editor.action.smartSelect.shrink",
        // Quick fix and refactoring
        "quick-fix": "editor.action.quickFix",
        refactor: "editor.action.refactor",
        "source-action": "editor.action.sourceAction",
        // Rename symbol
        "rename-symbol": "editor.action.rename",
        // Go to type definition
        "go-to-type-definition": "editor.action.goToTypeDefinition",
        // Find references
        "find-all-references": "editor.action.referenceSearch.trigger",
        // Show call hierarchy
        "show-call-hierarchy": "editor.showCallHierarchy",
        // Show type hierarchy
        "show-type-hierarchy": "editor.showTypeHierarchy",
        // Organize imports
        "organize-imports": "editor.action.organizeImports",
        // Sort imports
        "sort-imports": "editor.action.sortImports",
        // Remove unused imports
        "remove-unused-imports": "editor.action.removeUnusedImports",
        // Add imports for all unresolved symbols
        "add-missing-imports": "editor.action.addMissingImports",
        // Toggle column selection mode
        "toggle-column-selection": "editor.action.toggleColumnSelection",
      };

      const monacoCommand = commandMap[command];
      if (monacoCommand) {
        editor.trigger("external", monacoCommand, null);
        editor.focus();
      }
    };

    // Handle format document event
    const handleFormatDocument = () => {
      editor.trigger("format", "editor.action.formatDocument", null);
    };

    // Handle toggle word wrap event
    const handleToggleWordWrap = () => {
      const currentWrap = editor.getOption(monaco.editor.EditorOption.wordWrap);
      editor.updateOptions({ wordWrap: currentWrap === "off" ? "on" : "off" });
    };

    // Handle toggle minimap event
    const handleToggleMinimap = () => {
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.minimap,
      );
      editor.updateOptions({ minimap: { enabled: !currentOption.enabled } });
    };

    // Handle toggle sticky scroll event
    const handleToggleStickyScroll = () => {
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.stickyScroll,
      );
      const newEnabled = !currentOption.enabled;
      editor.updateOptions({
        stickyScroll: { enabled: newEnabled, maxLineCount: 5 },
      });
      // Persist the setting
      updateEditorSetting("stickyScrollEnabled", newEnabled);
    };

    // Handle toggle bracket pair colorization event
    const handleToggleBracketColorization = () => {
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.bracketPairColorization,
      );
      const newEnabled = !currentOption.enabled;
      editor.updateOptions({
        bracketPairColorization: {
          enabled: newEnabled,
          independentColorPoolPerBracketType: true,
        },
      });
      // Persist the setting
      updateEditorSetting("bracketPairColorization", newEnabled);
    };

    // Handle toggle bracket pair guides event
    const handleToggleBracketGuides = () => {
      const currentOption = editor.getOption(monaco.editor.EditorOption.guides);
      const newEnabled = !currentOption.bracketPairs;
      editor.updateOptions({
        guides: {
          ...currentOption,
          bracketPairs: newEnabled,
          bracketPairsHorizontal: newEnabled,
        },
      });
      // Persist the setting
      updateEditorSetting("guidesBracketPairs", newEnabled);
    };

    // Handle toggle indentation guides event
    const handleToggleIndentationGuides = () => {
      const currentOption = editor.getOption(monaco.editor.EditorOption.guides);
      const newEnabled = !currentOption.indentation;
      editor.updateOptions({
        guides: {
          ...currentOption,
          indentation: newEnabled,
          highlightActiveIndentation: newEnabled,
        },
      });
      // Persist the setting
      updateEditorSetting("guidesIndentation", newEnabled);
    };

    // Handle toggle inlay hints event
    const handleToggleInlayHints = () => {
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.inlayHints,
      );
      const currentEnabled = currentOption.enabled;
      const newEnabled: "on" | "off" = currentEnabled === "on" ? "off" : "on";
      editor.updateOptions({
        inlayHints: {
          ...currentOption,
          enabled: newEnabled,
        },
      });
      updateInlayHintSettings({ enabled: newEnabled });
    };

    // Handle toggle unicode highlight event
    const handleToggleUnicodeHighlight = () => {
      const newEnabled = !getUnicodeHighlightSettings().enabled;
      updateUnicodeHighlightSettings({ enabled: newEnabled });
      editor.updateOptions({
        unicodeHighlight: {
          ambiguousCharacters: newEnabled
            ? getUnicodeHighlightSettings().ambiguousCharacters
            : false,
          invisibleCharacters: newEnabled
            ? getUnicodeHighlightSettings().invisibleCharacters
            : false,
          nonBasicASCII: newEnabled
            ? getUnicodeHighlightSettings().nonBasicASCII
            : false,
        },
      });
    };

    // Handle unicode highlight settings change event
    const handleUnicodeHighlightSettingsChange = (
      e: CustomEvent<{
        enabled?: boolean;
        invisibleCharacters?: boolean;
        ambiguousCharacters?: boolean;
        nonBasicASCII?: boolean;
      }>,
    ) => {
      const {
        enabled,
        invisibleCharacters,
        ambiguousCharacters,
        nonBasicASCII,
      } = e.detail;

      // Update global settings
      updateUnicodeHighlightSettings({
        enabled: enabled ?? getUnicodeHighlightSettings().enabled,
        invisibleCharacters:
          invisibleCharacters ??
          getUnicodeHighlightSettings().invisibleCharacters,
        ambiguousCharacters:
          ambiguousCharacters ??
          getUnicodeHighlightSettings().ambiguousCharacters,
        nonBasicASCII:
          nonBasicASCII ?? getUnicodeHighlightSettings().nonBasicASCII,
      });

      // Update editor options
      editor.updateOptions({
        unicodeHighlight: {
          ambiguousCharacters:
            ambiguousCharacters ??
            getUnicodeHighlightSettings().ambiguousCharacters,
          invisibleCharacters:
            invisibleCharacters ??
            getUnicodeHighlightSettings().invisibleCharacters,
          nonBasicASCII:
            nonBasicASCII ?? getUnicodeHighlightSettings().nonBasicASCII,
        },
      });
    };

    // Handle toggle linked editing event
    const handleToggleLinkedEditing = () => {
      const newEnabled = !linkedEditingEnabled;
      updateLinkedEditingEnabled(newEnabled);
      editor.updateOptions({ linkedEditing: newEnabled });
      // Persist the setting
      updateEditorSetting("linkedEditing", newEnabled);
    };

    // Handle toggle format on type event
    const handleToggleFormatOnType = () => {
      const newEnabled = !getFormatOnTypeSettings().enabled;
      updateFormatOnTypeSettings({ enabled: newEnabled });
      editor.updateOptions({ formatOnType: newEnabled });
      // Persist the setting
      updateEditorSetting("formatOnType", newEnabled);
    };

    // Handle toggle format on paste event
    const handleToggleFormatOnPaste = () => {
      const newEnabled = !formatOnPasteEnabled;
      updateFormatOnPasteEnabled(newEnabled);
      // Persist the setting
      updateEditorSetting("formatOnPaste", newEnabled);
    };

    // Handle format on type settings change event
    const handleFormatOnTypeSettingsChange = (
      e: CustomEvent<{
        enabled?: boolean;
        triggerCharacters?: string[];
      }>,
    ) => {
      const { enabled, triggerCharacters } = e.detail;

      // Update editor option
      if (enabled !== undefined) {
        editor.updateOptions({ formatOnType: enabled });
      }

      // Update global settings
      updateFormatOnTypeSettings({
        enabled: enabled ?? getFormatOnTypeSettings().enabled,
        triggerCharacters:
          triggerCharacters ?? getFormatOnTypeSettings().triggerCharacters,
      });
    };

    // =========================================================================
    // Coverage Decoration Event Handlers
    // =========================================================================

    /**
     * Update coverage decorations for the current file
     */
    const updateCoverageDecorationsForFile = () => {
      const file = activeFile();
      if (!file || !testing.state.showCoverageDecorations) {
        clearCoverageDecorations(editor);
        return;
      }

      const coverage = testing.getCoverageForFile(file.path);
      if (coverage && coverage.lines.length > 0) {
        applyCoverageDecorations(editor, monaco, coverage.lines);
      } else {
        clearCoverageDecorations(editor);
      }
    };

    // Handle coverage data updated event
    const handleCoverageUpdated = () => {
      updateCoverageDecorationsForFile();
    };

    // Handle coverage visibility changed event
    const handleCoverageVisibilityChanged = (
      e: CustomEvent<{ visible: boolean }>,
    ) => {
      if (!e.detail) return;
      if (e.detail.visible) {
        updateCoverageDecorationsForFile();
      } else {
        clearCoverageDecorations(editor);
      }
    };

    // Handle coverage cleared event
    const handleCoverageCleared = () => {
      clearCoverageDecorations(editor);
    };

    // Handle toggle coverage decorations event
    const handleToggleCoverageDecorations = () => {
      testing.toggleCoverageDecorations();
    };

    // Initial coverage decoration application
    if (testing.state.showCoverageDecorations) {
      updateCoverageDecorationsForFile();
    }

    // Handle inlay hints settings change event
    const handleInlayHintsSettingsChange = (
      e: CustomEvent<{
        enabled?: "on" | "off" | "onUnlessPressed" | "offUnlessPressed";
        fontSize?: number;
        showParameterNames?: boolean;
        showTypeHints?: boolean;
      }>,
    ) => {
      const { enabled, fontSize, showParameterNames, showTypeHints } = e.detail;
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.inlayHints,
      );

      // Update editor options
      editor.updateOptions({
        inlayHints: {
          ...currentOption,
          enabled: enabled ?? currentOption.enabled,
          fontSize: fontSize ?? currentOption.fontSize,
        },
      });

      // Update global settings
      updateInlayHintSettings({
        enabled: enabled ?? getInlayHintSettings().enabled,
        fontSize: fontSize ?? getInlayHintSettings().fontSize,
        showParameterNames:
          showParameterNames ?? getInlayHintSettings().showParameterNames,
        showTypeHints: showTypeHints ?? getInlayHintSettings().showTypeHints,
      });
    };

    // Handle buffer-search-highlights event (from BufferSearch)
    // Track decorations for cleanup
    let searchDecorations: string[] = [];

    const handleBufferSearchHighlights = (
      e: CustomEvent<{
        decorations: Array<{
          range: {
            startLine: number;
            startColumn: number;
            endLine: number;
            endColumn: number;
          };
          isCurrent: boolean;
        }>;
      }>,
    ) => {
      const { decorations } = e.detail;
      const model = editor.getModel();
      if (!model) return;

      // Create Monaco decorations for search matches
      // Colors based on VS Code search highlight conventions:
      // - Current match: Bright yellow/orange for high visibility
      // - Other matches: Semi-transparent yellow for overview ruler
      const newDecorations = decorations.map((dec) => ({
        range: new monaco.Range(
          dec.range.startLine,
          dec.range.startColumn,
          dec.range.endLine,
          dec.range.endColumn,
        ),
        options: {
          className: dec.isCurrent ? "search-match-current" : "search-match",
          overviewRuler: {
            // Bright orange for current match, yellow/orange for others
            color: dec.isCurrent
              ? "rgba(249, 168, 37, 1)"
              : "rgba(230, 180, 60, 0.7)",
            position: monaco.editor.OverviewRulerLane.Center,
          },
          minimap: {
            color: dec.isCurrent
              ? "rgba(249, 168, 37, 1)"
              : "rgba(230, 180, 60, 0.7)",
            position: monaco.editor.MinimapPosition.Inline,
          },
        },
      }));

      // Update decorations (deltaDecorations handles cleanup of old ones)
      searchDecorations = editor.deltaDecorations(
        searchDecorations,
        newDecorations,
      );
    };

    // ============================================================================
    // Debug Inline Values Decorations
    // ============================================================================

    let inlineValueDecorations: string[] = [];

    const updateInlineValueDecorations = (
      values: InlineValueInfo[],
      filePath: string,
    ) => {
      const model = editor.getModel();
      if (!model) {
        inlineValueDecorations = editor.deltaDecorations(
          inlineValueDecorations,
          [],
        );
        return;
      }
      const currentFile = activeFile();
      if (!currentFile || currentFile.path !== filePath) {
        return;
      }
      const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];
      const escapeRegExp = (str: string): string =>
        str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      for (const inlineValue of values) {
        const lineContent = model.getLineContent(inlineValue.line);
        const regex = new RegExp(
          `\\b${escapeRegExp(inlineValue.name)}\\b`,
          "g",
        );
        let match: RegExpExecArray | null;
        let firstMatch = true;

        while ((match = regex.exec(lineContent)) !== null) {
          if (firstMatch) {
            firstMatch = false;
            const endColumn = match.index + inlineValue.name.length + 1;
            newDecorations.push({
              range: new monaco.Range(
                inlineValue.line,
                endColumn,
                inlineValue.line,
                endColumn,
              ),
              options: {
                after: {
                  content: ` = ${inlineValue.value}`,
                  inlineClassName: "debug-inline-value",
                },
                hoverMessage: {
                  value: `**${inlineValue.name}**${inlineValue.type ? ` (${inlineValue.type})` : ""}\n\n\`\`\`\n${inlineValue.fullValue}\n\`\`\``,
                },
              },
            });
          }
        }
      }
      inlineValueDecorations = editor.deltaDecorations(
        inlineValueDecorations,
        newDecorations,
      );
    };

    const clearInlineValueDecorations = () => {
      inlineValueDecorations = editor.deltaDecorations(
        inlineValueDecorations,
        [],
      );
    };

    const handleDebugInlineValuesUpdated = (
      e: CustomEvent<{ path: string; values: InlineValueInfo[] }>,
    ) => {
      const { path, values } = e.detail;
      updateInlineValueDecorations(values, path);
    };

    const handleDebugCleared = () => {
      clearInlineValueDecorations();
    };

    /** Handle debug:toggle-breakpoint - toggle breakpoint at current cursor line */
    const handleDebugToggleBreakpoint = (e: CustomEvent<{ path: string }>) => {
      const currentFile = activeFile();
      // Only handle if this editor is showing the target file
      if (!currentFile || e.detail.path !== currentFile.path) return;

      const position = editor.getPosition();
      if (position) {
        window.dispatchEvent(
          new CustomEvent("debug:toggle-breakpoint-at-line", {
            detail: { path: currentFile.path, line: position.lineNumber },
          }),
        );
      }
    };

    /** Handle debug:jump-to-cursor-request - respond with current cursor position for jump */
    const handleDebugJumpToCursorRequest = (
      e: CustomEvent<{ path: string }>,
    ) => {
      const currentFile = activeFile();
      // Only handle if this editor is showing the target file
      if (!currentFile || e.detail.path !== currentFile.path) return;

      const position = editor.getPosition();
      if (position) {
        window.dispatchEvent(
          new CustomEvent("debug:jump-to-cursor-execute", {
            detail: { path: currentFile.path, line: position.lineNumber },
          }),
        );
      }
    };

    // =========================================================================
    // Emmet Event Handlers
    // =========================================================================

    /** Handle Emmet: Balance Inward - select inner content of current tag */
    const handleEmmetBalanceInward = () => {
      balanceInward(editor, monaco);
      editor.focus();
    };

    /** Handle Emmet: Balance Outward - select parent element */
    const handleEmmetBalanceOutward = () => {
      balanceOutward(editor, monaco);
      editor.focus();
    };

    /** Handle Emmet: Get Selection - respond with current selection for wrap dialog */
    const handleEmmetGetSelection = () => {
      const text = getSelectionForWrap(editor);
      window.dispatchEvent(
        new CustomEvent("emmet:selection-response", {
          detail: { text },
        }),
      );
    };

    /** Handle Emmet: Wrap - wrap selection with abbreviation */
    const handleEmmetWrap = (e: CustomEvent<{ abbreviation: string }>) => {
      const { abbreviation } = e.detail;
      if (abbreviation) {
        wrapWithAbbreviation(editor, monaco, abbreviation);
        editor.focus();
      }
    };

    // =========================================================================
    // Inline Blame Event Handlers
    // =========================================================================

    /** Handle inline blame mode change */
    const handleInlineBlameModeChange = (
      e: CustomEvent<{ mode: InlineBlameMode }>,
    ) => {
      const { mode } = e.detail;
      if (inlineBlameManager) {
        inlineBlameManager.setMode(mode);
      }
    };

    /** Handle toggle inline blame */
    const handleToggleInlineBlame = () => {
      toggleInlineBlame();
    };

    // =========================================================================
    // Zen Mode Line Numbers Event Handlers
    // =========================================================================

    /** Store original line numbers setting for restoration */
    let zenModeOriginalLineNumbers: "on" | "off" | "relative" | "interval" =
      "on";

    /** Handle Zen Mode enter - hide line numbers if setting enabled */
    const handleZenModeEnter = (
      e: CustomEvent<{ settings: { hideLineNumbers?: boolean } }>,
    ) => {
      const { settings } = e.detail || {};
      if (settings?.hideLineNumbers) {
        // Store current line numbers setting
        const currentOption = editor.getOption(
          monaco.editor.EditorOption.lineNumbers,
        );
        zenModeOriginalLineNumbers =
          currentOption.renderType === 0
            ? "off"
            : currentOption.renderType === 1
              ? "on"
              : currentOption.renderType === 2
                ? "relative"
                : "interval";
        // Hide line numbers
        editor.updateOptions({ lineNumbers: "off" });
      }
    };

    /** Handle Zen Mode exit - restore line numbers if they were hidden */
    const handleZenModeExit = (
      e: CustomEvent<{ savedState?: { lineNumbers?: string } }>,
    ) => {
      const { savedState } = e.detail || {};
      // Restore line numbers to saved state or original setting
      const restoreTo =
        (savedState?.lineNumbers as "on" | "off" | "relative" | "interval") ||
        zenModeOriginalLineNumbers ||
        "on";
      editor.updateOptions({ lineNumbers: restoreTo });
    };

    /** Handle explicit hide line numbers event from Zen Mode */
    const handleZenModeHideLineNumbers = () => {
      // Store current setting if not already stored
      const currentOption = editor.getOption(
        monaco.editor.EditorOption.lineNumbers,
      );
      zenModeOriginalLineNumbers =
        currentOption.renderType === 0
          ? "off"
          : currentOption.renderType === 1
            ? "on"
            : currentOption.renderType === 2
              ? "relative"
              : "interval";
      editor.updateOptions({ lineNumbers: "off" });
    };

    /** Handle restore line numbers event from Zen Mode */
    const handleZenModeRestoreLineNumbers = (
      e: CustomEvent<{ lineNumbers?: string }>,
    ) => {
      const restoreTo =
        (e.detail?.lineNumbers as "on" | "off" | "relative" | "interval") ||
        zenModeOriginalLineNumbers ||
        "on";
      editor.updateOptions({ lineNumbers: restoreTo });
    };

    // =========================================================================
    // Git Diff Navigation Event Handlers
    // =========================================================================

    /** Handle go to next git change */
    const handleGoToNextChange = () => {
      const file = activeFile();
      if (file?.path) {
        goToNextChange(editor, file.path);
      }
    };

    /** Handle go to previous git change */
    const handleGoToPrevChange = () => {
      const file = activeFile();
      if (file?.path) {
        goToPrevChange(editor, file.path);
      }
    };

    /** Handle editor:action events (for triggering Monaco actions by id) */
    const handleEditorAction = (e: CustomEvent<{ action: string }>) => {
      const { action } = e.detail;
      if (action) {
        const monacoAction = editor.getAction(action);
        if (monacoAction) {
          monacoAction.run();
        }
        editor.focus();
      }
    };

    // Handle editor:set-cursor-position event (from NavigationHistoryContext for back/forward)
    const handleSetCursorPosition = (
      e: CustomEvent<{ filePath: string; line: number; column: number }>,
    ) => {
      const currentFile = activeFile();
      // Only handle if this editor is showing the target file
      if (!currentFile || e.detail.filePath !== currentFile.path) return;

      const { line, column } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    // Add event listeners
    window.addEventListener("goto-line", handleGotoLine as EventListener);
    window.addEventListener(
      "editor:goto-line",
      handleEditorGotoLine as EventListener,
    );
    window.addEventListener(
      "editor:set-cursor-position",
      handleSetCursorPosition as EventListener,
    );
    window.addEventListener(
      "outline:navigate",
      handleOutlineNavigate as EventListener,
    );
    window.addEventListener(
      "buffer-search-goto",
      handleBufferSearchGoto as EventListener,
    );
    window.addEventListener(
      "buffer-search-highlights",
      handleBufferSearchHighlights as EventListener,
    );
    window.addEventListener(
      "buffer-search:get-selection",
      handleBufferSearchGetSelection,
    );
    window.addEventListener(
      "editor-command",
      handleEditorCommand as unknown as EventListener,
    );
    window.addEventListener("editor-format-document", handleFormatDocument);
    window.addEventListener("editor-toggle-word-wrap", handleToggleWordWrap);
    window.addEventListener("editor-toggle-minimap", handleToggleMinimap);
    window.addEventListener(
      "editor-toggle-sticky-scroll",
      handleToggleStickyScroll,
    );
    window.addEventListener(
      "editor-toggle-bracket-colorization",
      handleToggleBracketColorization,
    );
    window.addEventListener(
      "editor-toggle-bracket-guides",
      handleToggleBracketGuides,
    );
    window.addEventListener(
      "editor-toggle-indentation-guides",
      handleToggleIndentationGuides,
    );
    window.addEventListener(
      "editor-toggle-inlay-hints",
      handleToggleInlayHints,
    );
    window.addEventListener(
      "editor-toggle-unicode-highlight",
      handleToggleUnicodeHighlight,
    );
    window.addEventListener(
      "editor-unicode-highlight-settings",
      handleUnicodeHighlightSettingsChange as EventListener,
    );
    window.addEventListener(
      "editor-toggle-linked-editing",
      handleToggleLinkedEditing,
    );
    window.addEventListener(
      "editor-toggle-format-on-type",
      handleToggleFormatOnType,
    );
    window.addEventListener(
      "editor-toggle-format-on-paste",
      handleToggleFormatOnPaste,
    );
    window.addEventListener(
      "editor-inlay-hints-settings",
      handleInlayHintsSettingsChange as EventListener,
    );
    window.addEventListener(
      "editor-format-on-type-settings",
      handleFormatOnTypeSettingsChange as EventListener,
    );
    window.addEventListener("testing:coverage-updated", handleCoverageUpdated);
    window.addEventListener(
      "testing:coverage-visibility-changed",
      handleCoverageVisibilityChanged as EventListener,
    );
    window.addEventListener("testing:coverage-cleared", handleCoverageCleared);
    window.addEventListener(
      "editor-toggle-coverage-decorations",
      handleToggleCoverageDecorations,
    );
    window.addEventListener(
      "debug:inlineValuesUpdated",
      handleDebugInlineValuesUpdated as EventListener,
    );
    window.addEventListener("debug:cleared", handleDebugCleared);
    window.addEventListener(
      "debug:toggle-breakpoint",
      handleDebugToggleBreakpoint as EventListener,
    );
    window.addEventListener(
      "debug:jump-to-cursor-request",
      handleDebugJumpToCursorRequest as EventListener,
    );
    window.addEventListener("emmet:balance-inward", handleEmmetBalanceInward);
    window.addEventListener("emmet:balance-outward", handleEmmetBalanceOutward);
    window.addEventListener("emmet:get-selection", handleEmmetGetSelection);
    window.addEventListener("emmet:wrap", handleEmmetWrap as EventListener);
    window.addEventListener(
      "inline-blame:mode-changed",
      handleInlineBlameModeChange as EventListener,
    );
    window.addEventListener("inline-blame:toggle", handleToggleInlineBlame);
    window.addEventListener("git:go-to-next-change", handleGoToNextChange);
    window.addEventListener("git:go-to-prev-change", handleGoToPrevChange);
    window.addEventListener(
      "editor:action",
      handleEditorAction as EventListener,
    );
    window.addEventListener(
      "zenmode:enter",
      handleZenModeEnter as EventListener,
    );
    window.addEventListener("zenmode:exit", handleZenModeExit as EventListener);
    window.addEventListener(
      "zenmode:hide-line-numbers",
      handleZenModeHideLineNumbers,
    );
    window.addEventListener(
      "zenmode:restore-line-numbers",
      handleZenModeRestoreLineNumbers as EventListener,
    );
    window.addEventListener(
      "editor:get-selection-for-terminal",
      handleGetSelectionForTerminal,
    );
    window.addEventListener(
      "editor:get-active-file-for-terminal",
      handleGetActiveFileForTerminal,
    );

    // Store cleanup functions
    eventCleanupFns.push(
      () =>
        window.removeEventListener(
          "goto-line",
          handleGotoLine as EventListener,
        ),
      () =>
        window.removeEventListener(
          "editor:goto-line",
          handleEditorGotoLine as EventListener,
        ),
      () =>
        window.removeEventListener(
          "editor:set-cursor-position",
          handleSetCursorPosition as EventListener,
        ),
      () =>
        window.removeEventListener(
          "outline:navigate",
          handleOutlineNavigate as EventListener,
        ),
      () =>
        window.removeEventListener(
          "buffer-search-goto",
          handleBufferSearchGoto as EventListener,
        ),
      () =>
        window.removeEventListener(
          "buffer-search-highlights",
          handleBufferSearchHighlights as EventListener,
        ),
      () =>
        window.removeEventListener(
          "buffer-search:get-selection",
          handleBufferSearchGetSelection,
        ),
      () =>
        window.removeEventListener(
          "editor-command",
          handleEditorCommand as unknown as EventListener,
        ),
      () =>
        window.removeEventListener(
          "editor-format-document",
          handleFormatDocument,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-word-wrap",
          handleToggleWordWrap,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-minimap",
          handleToggleMinimap,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-sticky-scroll",
          handleToggleStickyScroll,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-bracket-colorization",
          handleToggleBracketColorization,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-bracket-guides",
          handleToggleBracketGuides,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-indentation-guides",
          handleToggleIndentationGuides,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-inlay-hints",
          handleToggleInlayHints,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-unicode-highlight",
          handleToggleUnicodeHighlight,
        ),
      () =>
        window.removeEventListener(
          "editor-unicode-highlight-settings",
          handleUnicodeHighlightSettingsChange as EventListener,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-linked-editing",
          handleToggleLinkedEditing,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-format-on-type",
          handleToggleFormatOnType,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-format-on-paste",
          handleToggleFormatOnPaste,
        ),
      () =>
        window.removeEventListener(
          "editor-inlay-hints-settings",
          handleInlayHintsSettingsChange as EventListener,
        ),
      () =>
        window.removeEventListener(
          "editor-format-on-type-settings",
          handleFormatOnTypeSettingsChange as EventListener,
        ),
      () =>
        window.removeEventListener(
          "testing:coverage-updated",
          handleCoverageUpdated,
        ),
      () =>
        window.removeEventListener(
          "testing:coverage-visibility-changed",
          handleCoverageVisibilityChanged as EventListener,
        ),
      () =>
        window.removeEventListener(
          "testing:coverage-cleared",
          handleCoverageCleared,
        ),
      () =>
        window.removeEventListener(
          "editor-toggle-coverage-decorations",
          handleToggleCoverageDecorations,
        ),
      () =>
        window.removeEventListener(
          "debug:inlineValuesUpdated",
          handleDebugInlineValuesUpdated as EventListener,
        ),
      () => window.removeEventListener("debug:cleared", handleDebugCleared),
      () =>
        window.removeEventListener(
          "debug:toggle-breakpoint",
          handleDebugToggleBreakpoint as EventListener,
        ),
      () =>
        window.removeEventListener(
          "debug:jump-to-cursor-request",
          handleDebugJumpToCursorRequest as EventListener,
        ),
      () =>
        window.removeEventListener(
          "emmet:balance-inward",
          handleEmmetBalanceInward,
        ),
      () =>
        window.removeEventListener(
          "emmet:balance-outward",
          handleEmmetBalanceOutward,
        ),
      () =>
        window.removeEventListener(
          "emmet:get-selection",
          handleEmmetGetSelection,
        ),
      () =>
        window.removeEventListener(
          "emmet:wrap",
          handleEmmetWrap as EventListener,
        ),
      () =>
        window.removeEventListener(
          "inline-blame:mode-changed",
          handleInlineBlameModeChange as EventListener,
        ),
      () =>
        window.removeEventListener(
          "inline-blame:toggle",
          handleToggleInlineBlame,
        ),
      () =>
        window.removeEventListener(
          "git:go-to-next-change",
          handleGoToNextChange,
        ),
      () =>
        window.removeEventListener(
          "git:go-to-prev-change",
          handleGoToPrevChange,
        ),
      () =>
        window.removeEventListener(
          "editor:action",
          handleEditorAction as EventListener,
        ),
      () =>
        window.removeEventListener(
          "zenmode:enter",
          handleZenModeEnter as EventListener,
        ),
      () =>
        window.removeEventListener(
          "zenmode:exit",
          handleZenModeExit as EventListener,
        ),
      () =>
        window.removeEventListener(
          "zenmode:hide-line-numbers",
          handleZenModeHideLineNumbers,
        ),
      () =>
        window.removeEventListener(
          "zenmode:restore-line-numbers",
          handleZenModeRestoreLineNumbers as EventListener,
        ),
      () =>
        window.removeEventListener(
          "editor:get-selection-for-terminal",
          handleGetSelectionForTerminal,
        ),
      () =>
        window.removeEventListener(
          "editor:get-active-file-for-terminal",
          handleGetActiveFileForTerminal,
        ),
      () => {
        searchDecorations = editor.deltaDecorations(searchDecorations, []);
      }, // Clear search decorations on cleanup
      () => {
        clearCoverageDecorations(editor);
      }, // Clear coverage decorations on cleanup
      () => {
        clearInlineValueDecorations();
      }, // Clear debug inline values on cleanup
      () => {
        if (inlineBlameManager) {
          inlineBlameManager.dispose();
          inlineBlameManager = null;
        }
      }, // Clear inline blame on cleanup
    );

    // Cleanup when editor is disposed
    editor.onDidDispose(() => {
      eventCleanupFns.forEach((fn) => fn());
      eventCleanupFns.length = 0;
    });
  }

  function setupMultiCursorActions(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    _fileId: string,
  ) {
    editor.addAction({
      id: "add-cursor-above",
      label: "Add Cursor Above",
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow,
      ],
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.insertCursorAbove", null);
      },
    });

    editor.addAction({
      id: "add-cursor-below",
      label: "Add Cursor Below",
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow,
      ],
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.insertCursorBelow", null);
      },
    });

    editor.addAction({
      id: "select-all-occurrences",
      label: "Select All Occurrences",
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL,
      ],
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.selectHighlights", null);
      },
    });

    editor.addAction({
      id: "add-selection-to-next-find-match",
      label: "Add Selection to Next Find Match",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD],
      run: (ed) => {
        ed.trigger(
          "keyboard",
          "editor.action.addSelectionToNextFindMatch",
          null,
        );
      },
    });

    editor.addAction({
      id: "add-cursors-to-line-ends",
      label: "Add Cursors to Line Ends",
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyI,
      ],
      run: (ed) => {
        ed.trigger(
          "keyboard",
          "editor.action.insertCursorAtEndOfEachLineSelected",
          null,
        );
      },
    });

    editor.addAction({
      id: "expand-selection",
      label: "Expand Selection",
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow,
      ],
      run: async (ed) => {
        // Use SmartSelectManager for LSP-aware expansion with history tracking
        await smartSelectManager.expandSelection(
          ed as Monaco.editor.IStandaloneCodeEditor,
          monaco,
        );
      },
    });

    editor.addAction({
      id: "shrink-selection",
      label: "Shrink Selection",
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow,
      ],
      run: (ed) => {
        // Use SmartSelectManager for history-aware shrinking
        smartSelectManager.shrinkSelection(
          ed as Monaco.editor.IStandaloneCodeEditor,
          monaco,
        );
      },
    });

    editor.addAction({
      id: "undo-cursor",
      label: "Undo Last Cursor Operation",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU],
      run: (ed) => {
        ed.trigger("keyboard", "cursorUndo", null);
      },
    });

    editor.addAction({
      id: "remove-secondary-cursors",
      label: "Remove Secondary Cursors",
      keybindings: [monaco.KeyCode.Escape],
      precondition: "hasMultipleSelections",
      run: (ed) => {
        const selections = ed.getSelections();
        if (selections && selections.length > 1) {
          ed.setSelection(selections[0]);
        }
      },
    });

    editor.addAction({
      id: "select-line",
      label: "Select Line",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL],
      run: (ed) => {
        ed.trigger("keyboard", "expandLineSelection", null);
      },
    });

    editor.addAction({
      id: "move-line-up",
      label: "Move Line Up",
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.UpArrow],
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.moveLinesUpAction", null);
      },
    });

    editor.addAction({
      id: "move-line-down",
      label: "Move Line Down",
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.DownArrow],
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.moveLinesDownAction", null);
      },
    });

    editor.addAction({
      id: "copy-line-up",
      label: "Copy Line Up",
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow,
      ],
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.copyLinesUpAction", null);
      },
    });

    editor.addAction({
      id: "copy-line-down",
      label: "Copy Line Down",
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow,
      ],
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.copyLinesDownAction", null);
      },
    });

    editor.addAction({
      id: "duplicate-selection",
      label: "Duplicate Selection",
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD,
      ],
      run: (ed) => {
        const selections = ed.getSelections();
        if (!selections || selections.length === 0) return;

        const model = ed.getModel();
        if (!model) return;

        const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [];
        const newSelections: Monaco.Selection[] = [];

        selections.forEach((selection) => {
          const text = model.getValueInRange(selection);

          if (selection.isEmpty()) {
            const lineNumber = selection.startLineNumber;
            const lineContent = model.getLineContent(lineNumber);
            const lineEndColumn = model.getLineMaxColumn(lineNumber);

            edits.push({
              range: new monaco.Range(
                lineNumber,
                lineEndColumn,
                lineNumber,
                lineEndColumn,
              ),
              text: "\n" + lineContent,
            });

            newSelections.push(
              new monaco.Selection(
                lineNumber + 1,
                selection.startColumn,
                lineNumber + 1,
                selection.endColumn,
              ),
            );
          } else {
            edits.push({
              range: new monaco.Range(
                selection.endLineNumber,
                selection.endColumn,
                selection.endLineNumber,
                selection.endColumn,
              ),
              text: text,
            });

            const linesAdded = text.split("\n").length - 1;
            const newStartLine = selection.endLineNumber;
            const newStartColumn = selection.endColumn;

            newSelections.push(
              new monaco.Selection(
                newStartLine,
                newStartColumn,
                newStartLine + linesAdded,
                linesAdded > 0
                  ? text.split("\n").pop()!.length + 1
                  : newStartColumn + text.length,
              ),
            );
          }
        });

        ed.executeEdits("duplicate-selection", edits);
        ed.setSelections(newSelections);
      },
    });

    editor.addAction({
      id: "transform-to-uppercase",
      label: "Transform to Uppercase",
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.transformToUppercase", null);
      },
    });

    editor.addAction({
      id: "transform-to-lowercase",
      label: "Transform to Lowercase",
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.transformToLowercase", null);
      },
    });

    editor.addAction({
      id: "transform-to-titlecase",
      label: "Transform to Title Case",
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.transformToTitlecase", null);
      },
    });

    // Custom text case transform actions
    const textTransforms = [
      {
        id: "transform-to-snakecase",
        label: "Transform to snake_case",
        fn: toSnakeCase,
      },
      {
        id: "transform-to-camelcase",
        label: "Transform to camelCase",
        fn: toCamelCase,
      },
      {
        id: "transform-to-pascalcase",
        label: "Transform to PascalCase",
        fn: toPascalCase,
      },
      {
        id: "transform-to-kebabcase",
        label: "Transform to kebab-case",
        fn: toKebabCase,
      },
      {
        id: "transform-to-constantcase",
        label: "Transform to CONSTANT_CASE",
        fn: toConstantCase,
      },
    ];

    for (const { id, label, fn } of textTransforms) {
      editor.addAction({
        id,
        label,
        run: (ed) => {
          const selections = ed.getSelections();
          if (!selections) return;

          const model = ed.getModel();
          if (!model) return;

          ed.pushUndoStop();

          const edits = selections.map((sel) => ({
            range: sel,
            text: fn(model.getValueInRange(sel)),
          }));

          ed.executeEdits("transform", edits);
          ed.pushUndoStop();
        },
      });
    }

    let isColumnSelecting = false;
    let columnSelectStart: { lineNumber: number; column: number } | null = null;

    editor.onMouseDown((e) => {
      if (e.event.shiftKey && e.event.altKey && e.target.position) {
        isColumnSelecting = true;
        columnSelectStart = e.target.position;
      }
    });

    editor.onMouseMove((e) => {
      if (isColumnSelecting && columnSelectStart && e.target.position) {
        const startLine = Math.min(
          columnSelectStart.lineNumber,
          e.target.position.lineNumber,
        );
        const endLine = Math.max(
          columnSelectStart.lineNumber,
          e.target.position.lineNumber,
        );
        const startColumn = Math.min(
          columnSelectStart.column,
          e.target.position.column,
        );
        const endColumn = Math.max(
          columnSelectStart.column,
          e.target.position.column,
        );

        const selections: Monaco.Selection[] = [];
        for (let line = startLine; line <= endLine; line++) {
          selections.push(
            new monaco.Selection(line, startColumn, line, endColumn),
          );
        }

        if (selections.length > 0) {
          editor.setSelections(selections);
        }
      }
    });

    editor.onMouseUp(() => {
      isColumnSelecting = false;
      columnSelectStart = null;
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "L") {
        e.preventDefault();
        editor.trigger("keyboard", "editor.action.selectHighlights", null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        editor.trigger(
          "keyboard",
          "editor.action.addSelectionToNextFindMatch",
          null,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    editor.onDidDispose(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });

    // Git diff navigation actions
    editor.addAction({
      id: "editor.action.dirtydiff.next",
      label: "Go to Next Change",
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F3],
      run: () => {
        const file = activeFile();
        if (file?.path) {
          goToNextChange(editor, file.path);
        }
      },
    });

    editor.addAction({
      id: "editor.action.dirtydiff.previous",
      label: "Go to Previous Change",
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.F3,
      ],
      run: () => {
        const file = activeFile();
        if (file?.path) {
          goToPrevChange(editor, file.path);
        }
      },
    });

    // Go to Bracket - Ctrl+Shift+\ (jump to matching bracket)
    editor.addAction({
      id: "editor.action.jumpToBracket",
      label: "Go to Bracket",
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Backslash,
      ],
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.jumpToBracket", null);
      },
    });

    // Select to Bracket - Ctrl+Shift+Alt+\ (select from cursor to matching bracket)
    editor.addAction({
      id: "editor.action.selectToBracket",
      label: "Select to Bracket",
      keybindings: [
        monaco.KeyMod.CtrlCmd |
          monaco.KeyMod.Shift |
          monaco.KeyMod.Alt |
          monaco.KeyCode.Backslash,
      ],
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.selectToBracket", null);
      },
    });

    // Peek Definition - Alt+F12 (show definition inline without navigating)
    editor.addAction({
      id: "editor.action.peekDefinition",
      label: "Peek Definition",
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F12],
      run: async (ed) => {
        const model = ed.getModel();
        const position = ed.getPosition();
        if (!model || !position) return;

        const uri = model.uri.toString();
        const filePath = uri.replace("file://", "");

        try {
          // Get language ID from model for LSP server selection
          const languageId = model.getLanguageId();

          // Call LSP definition via multi-provider (handles different LSP servers)
          const result = await invoke<{
            locations: Array<{
              uri: string;
              range: {
                start: { line: number; character: number };
                end: { line: number; character: number };
              };
            }>;
          }>("lsp_multi_definition", {
            language: languageId,
            params: {
              uri: filePath,
              position: {
                line: position.lineNumber - 1,
                character: position.column - 1,
              },
            },
          });

          if (!result || !result.locations || result.locations.length === 0) {
            // Fallback: try the standard lsp_definition
            const standardResult = await invoke<{
              locations: Array<{
                uri: string;
                range: {
                  start: { line: number; character: number };
                  end: { line: number; character: number };
                };
              }>;
            }>("lsp_definition", {
              serverId: languageId,
              params: {
                uri: filePath,
                position: {
                  line: position.lineNumber - 1,
                  character: position.column - 1,
                },
              },
            });

            if (
              !standardResult ||
              !standardResult.locations ||
              standardResult.locations.length === 0
            ) {
              console.debug("No definition found for peek");
              return;
            }

            // Convert LSP locations to PeekLocation format
            const peekLocations: PeekLocation[] = standardResult.locations.map(
              (loc) => ({
                uri: loc.uri.startsWith("file://")
                  ? loc.uri
                  : `file://${loc.uri}`,
                range: {
                  startLineNumber: loc.range.start.line + 1,
                  startColumn: loc.range.start.character + 1,
                  endLineNumber: loc.range.end.line + 1,
                  endColumn: loc.range.end.character + 1,
                },
              }),
            );

            // Show the peek widget
            showPeekWidget(peekLocations, position, uri);
            return;
          }

          // Convert LSP locations to PeekLocation format
          const peekLocations: PeekLocation[] = result.locations.map((loc) => ({
            uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`,
            range: {
              startLineNumber: loc.range.start.line + 1,
              startColumn: loc.range.start.character + 1,
              endLineNumber: loc.range.end.line + 1,
              endColumn: loc.range.end.character + 1,
            },
          }));

          // Show the peek widget
          showPeekWidget(peekLocations, position, uri);
        } catch (error) {
          console.error("Failed to get definition for peek:", error);
        }
      },
    });

    // Close Peek Widget - Escape when peek is open
    editor.addAction({
      id: "editor.action.closePeekWidget",
      label: "Close Peek Widget",
      keybindings: [monaco.KeyCode.Escape],
      precondition: undefined,
      run: () => {
        hidePeekWidget();
      },
    });
  }

  // Listen for VS Code extension theme changes and apply to Monaco
  createEffect(() => {
    const handleVSCodeThemeApplied = (e: Event) => {
      if (!monacoInstance) return;
      const detail = (e as CustomEvent).detail;
      if (detail?.theme) {
        import("@/utils/monaco-theme").then(({ applyThemeToMonaco }) => {
          applyThemeToMonaco(monacoInstance!, detail.theme);
        });
      }
    };

    const handleVSCodeThemeCleared = () => {
      if (!monacoInstance) return;
      monacoInstance.editor.setTheme("cortex-dark");
    };

    window.addEventListener("theme:vscode-extension-applied", handleVSCodeThemeApplied);
    window.addEventListener("theme:vscode-extension-cleared", handleVSCodeThemeCleared);

    onCleanup(() => {
      window.removeEventListener("theme:vscode-extension-applied", handleVSCodeThemeApplied);
      window.removeEventListener("theme:vscode-extension-cleared", handleVSCodeThemeCleared);
    });
  });

  // Listen for language change events from the language selector
  createEffect(() => {
    const handleLanguageChange = (
      e: CustomEvent<{ fileId: string; languageId: string }>,
    ) => {
      if (!e.detail) return;
      const file = activeFile();
      if (!file || !editorInstance || !monacoInstance) return;

      // Only update if the change is for the current file
      if (e.detail.fileId !== file.id) return;

      const model = editorInstance.getModel();
      if (model) {
        const monacoLanguage =
          LANGUAGE_MAP[e.detail.languageId] ||
          e.detail.languageId ||
          "plaintext";
        monacoInstance!.editor.setModelLanguage(model, monacoLanguage);
      }
    };

    window.addEventListener(
      "language:changed",
      handleLanguageChange as EventListener,
    );

    onCleanup(() => {
      window.removeEventListener(
        "language:changed",
        handleLanguageChange as EventListener,
      );
    });
  });

  // Watch for debug state changes to update inline values
  createEffect(() => {
    const isPaused = debug.state.isPaused;
    const inlineValuesEnabled = debug.state.inlineValuesEnabled;
    const currentFile = debug.state.currentFile;
    const variables = debug.state.variables;

    // Access values to trigger reactivity
    void isPaused;
    void inlineValuesEnabled;
    void currentFile;
    void variables;

    if (isPaused && inlineValuesEnabled && currentFile) {
      debug.refreshInlineValues();
    } else if (!isPaused || !inlineValuesEnabled) {
      window.dispatchEvent(new CustomEvent("debug:cleared"));
    }
  });

  // Watch for debug state changes to update debug hover provider
  createEffect(() => {
    const isPaused = debug.state.isPaused;
    const activeSessionId = debug.state.activeSessionId;

    // Update the debug hover state for the hover provider
    if (isPaused && activeSessionId) {
      updateDebugHoverState({
        isPaused: true,
        activeSessionId,
        evaluate: debug.evaluate,
        expandVariable: debug.expandVariable,
        addWatchExpression: debug.addWatchExpression,
      });
    } else {
      updateDebugHoverState(null);
    }
  });

  // Listen for agent activity to show orange border (Zed-style follow agent)
  let agentActiveTimer: ReturnType<typeof setTimeout> | null = null;

  const handleAgentActive = (
    e: CustomEvent<{
      path?: string;
      paths?: string[];
      action: string;
      duration: number;
      allSplits?: boolean;
    }>,
  ) => {
    const file = activeFile();
    const detail = e.detail;

    // Check if this editor should show orange border
    const shouldActivate =
      detail.allSplits || // All splits should be orange
      (file && detail.path === file.path) || // Single file match
      (file && detail.paths?.includes(file.path)); // Multi-file match

    if (shouldActivate) {
      setAgentActive(true);

      // Clear existing timer
      if (agentActiveTimer) {
        clearTimeout(agentActiveTimer);
      }

      // Auto-hide after duration (if positive), or keep until manually cleared
      if (detail.duration > 0) {
        agentActiveTimer = setTimeout(() => {
          setAgentActive(false);
        }, detail.duration);
      }
      // duration <= 0 means keep until editor:agentInactive event
    }
  };

  const handleAgentInactive = () => {
    setAgentActive(false);
    if (agentActiveTimer) {
      clearTimeout(agentActiveTimer);
      agentActiveTimer = null;
    }
  };

  window.addEventListener(
    "editor:agentActive",
    handleAgentActive as EventListener,
  );
  window.addEventListener("editor:agentInactive", handleAgentInactive);

  onCleanup(() => {
    window.removeEventListener(
      "editor:agentActive",
      handleAgentActive as EventListener,
    );
    window.removeEventListener("editor:agentInactive", handleAgentInactive);
    if (agentActiveTimer) clearTimeout(agentActiveTimer);
  });

  // ============================================================================
  // SmartSelectManager Cache Cleanup - Prevent memory leaks
  // ============================================================================

  // Handle file close events - clear caches for closed files
  const handleFileClose = (e: CustomEvent<{ path: string }>) => {
    if (monacoInstance && e.detail?.path) {
      const uri = monacoInstance!.Uri.file(e.detail.path).toString();
      smartSelectManager.clearFileCache(uri);
    }
  };

  // Handle file closing event - dispose Monaco editor before SolidJS cleanup
  // This prevents "Cannot read properties of null" errors in cleanNode
  const handleFileClosing = (e: CustomEvent<{ fileId: string }>) => {
    const closingFileId = e.detail?.fileId;
    if (closingFileId && props.file?.id === closingFileId && editorInstance) {
      try {
        // Detach model to prevent issues during disposal
        editorInstance.setModel(null);
        // Dispose the editor immediately
        editorInstance.dispose();
        editorInstance = null;
        setCurrentEditor(null);
        isDisposed = true;
      } catch (err) {
        console.debug(
          "[CodeEditor] Pre-close disposal error (safe to ignore):",
          err,
        );
      }
    }
  };

  window.addEventListener(
    "editor:file-closed",
    handleFileClose as EventListener,
  );
  window.addEventListener(
    "editor:file-closing",
    handleFileClosing as EventListener,
  );

  // Periodic cache pruning to clean up stale entries (every 60 seconds)
  const smartSelectPruneInterval = setInterval(() => {
    smartSelectManager.pruneOldCaches();
  }, 60000);

  onCleanup(() => {
    // Clean up SmartSelectManager cache pruning interval
    clearInterval(smartSelectPruneInterval);

    // Remove file close event listeners
    window.removeEventListener(
      "editor:file-closed",
      handleFileClose as EventListener,
    );
    window.removeEventListener(
      "editor:file-closing",
      handleFileClosing as EventListener,
    );

    // Clear all SmartSelectManager caches
    smartSelectManager.clearAllCaches();
  });

  onCleanup(() => {
    // Mark as disposed to prevent effects from running
    isDisposed = true;

    // Dispose format-on-paste handler
    if (formatOnPasteDisposable) {
      formatOnPasteDisposable?.dispose?.();
      formatOnPasteDisposable = null;
    }

    // Clear debug hover state
    updateDebugHoverState(null);

    // Schedule disposal of the current file's model
    if (currentFilePath) {
      monacoManager.scheduleModelDisposal(currentFilePath);
    }

    // IMPORTANT: Dispose editor BEFORE SolidJS cleans up the DOM
    // This prevents "Cannot read properties of null" errors during cleanup
    if (editorInstance) {
      try {
        // Detach model first to prevent issues
        editorInstance.setModel(null);
        // Dispose the editor completely (don't just release to pool)
        editorInstance.dispose();
      } catch (e) {
        // Ignore disposal errors during cleanup
        console.debug(
          "[CodeEditor] Cleanup disposal error (safe to ignore):",
          e,
        );
      }
      editorInstance = null;
      setCurrentEditor(null);
    }

    // Clear the container to prevent stale DOM references
    if (containerRef) {
      containerRef.innerHTML = "";
    }
  });

  // ============================================================================
  // Drop Into Editor - Handles file and text drops
  // ============================================================================

  let dragEnterCounter = 0; // Track nested drag enters/leaves

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragEnterCounter++;
    if (dragEnterCounter === 1) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragEnterCounter--;
    if (dragEnterCounter === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragEnterCounter = 0;
    setIsDraggingOver(false);

    if (!editorInstance || !monacoInstance || !e.dataTransfer) return;

    // Get the drop position in the editor
    const target = editorInstance.getTargetAtClientPoint(e.clientX, e.clientY);
    let position = editorInstance.getPosition();

    if (target && target.position) {
      position = target.position;
    }

    if (!position) return;

    // Handle dropped files
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const filePathsOrContent: string[] = [];

      // Extended File interface that may include path from Tauri
      interface TauriFile extends File {
        path?: string;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i] as TauriFile;
        // Get the file path if available (via Tauri's webkitRelativePath or path)
        const filePath = file.path || file.name;
        filePathsOrContent.push(filePath);
      }

      if (filePathsOrContent.length > 0) {
        // Insert file paths at the cursor position
        const textToInsert = filePathsOrContent.join("\n");

        editorInstance.executeEdits("drop-files", [
          {
            range: new monacoInstance!.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column,
            ),
            text: textToInsert,
          },
        ]);

        // Move cursor to end of inserted text
        const lines = textToInsert.split("\n");
        const lastLine = lines[lines.length - 1];
        const newPosition = {
          lineNumber: position.lineNumber + lines.length - 1,
          column:
            lines.length === 1
              ? position.column + lastLine.length
              : lastLine.length + 1,
        };
        editorInstance.setPosition(newPosition);
        editorInstance.focus();
        return;
      }
    }

    // Handle dropped text
    const droppedText =
      e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text");
    if (droppedText) {
      editorInstance.executeEdits("drop-text", [
        {
          range: new monacoInstance!.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column,
          ),
          text: droppedText,
        },
      ]);

      // Move cursor to end of inserted text
      const lines = droppedText.split("\n");
      const lastLine = lines[lines.length - 1];
      const newPosition = {
        lineNumber: position.lineNumber + lines.length - 1,
        column:
          lines.length === 1
            ? position.column + lastLine.length
            : lastLine.length + 1,
      };
      editorInstance.setPosition(newPosition);
      editorInstance.focus();
    }
  };

  return (
    <div
      class="flex-1 flex flex-col overflow-hidden relative transition-all duration-300"
      style={{
        // Figma design: Editor background must match active tab for seamless fusion
        background: "var(--cortex-bg-secondary, var(--cortex-bg-primary))",
        "box-shadow": agentActive()
          ? "inset 0 0 0 2px var(--cortex-warning)"
          : "none", // Orange border when agent is active
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Agent activity indicator - Zed-style orange glow */}
      <Show when={agentActive()}>
        <div
          class="absolute inset-0 pointer-events-none z-50 animate-pulse"
          style={{
            "box-shadow": "inset 0 0 20px rgba(249, 115, 22, 0.3)",
            border: "2px solid var(--jb-color-warning, var(--cortex-warning))",
            "border-radius": "var(--cortex-radius-sm)",
          }}
        />
      </Show>
      {/* Drop indicator overlay - shown when dragging files/text over editor */}
      <Show when={isDraggingOver()}>
        <div
          class="absolute inset-0 pointer-events-none z-40 flex items-center justify-center"
          style={{
            background: "rgba(99, 102, 241, 0.15)",
            border: "2px dashed var(--jb-border-focus, var(--cortex-info))",
            "border-radius": "var(--cortex-radius-sm)",
          }}
        >
          <div
            class="px-4 py-2 rounded-lg"
            style={{
              background: "var(--jb-panel)",
              border: "1px solid var(--jb-border-focus, var(--cortex-info))",
              color: "var(--jb-text-body-color)",
              "font-size": "var(--jb-text-body-size, 14px)",
            }}
          >
            Drop files or text here
          </div>
        </div>
      </Show>
      {/* Skeleton loader shown while Monaco is loading */}
      <Show when={isLoading() && activeFile()}>
        <EditorSkeleton lineCount={25} showMessage={true} />
      </Show>
      {/* Editor container - hidden while loading */}
      <div
        ref={containerRef}
        class="flex-1 relative"
        style={{ display: isLoading() || !activeFile() ? "none" : "block" }}
      >
        {/* Sticky Scroll Widget - Shows parent scope context at top of editor */}
        <StickyScrollWidget
          editor={currentEditor()}
          monaco={currentMonaco()}
          enabled={stickyScrollEnabled()}
          maxLineCount={stickyScrollMaxLines()}
          fontFamily={editorFontFamily()}
          fontSize={editorFontSize()}
          lineHeight={editorLineHeight()}
          onLineClick={(lineNumber) => {
            // Navigate to the clicked line
            const editor = currentEditor();
            if (editor) {
              editor.revealLineInCenter(lineNumber);
              editor.setPosition({ lineNumber, column: 1 });
              editor.focus();
            }
          }}
        />
      </div>
      {/* Vim Mode Integration */}
      <VimMode editor={currentEditor()} monaco={currentMonaco()} />
      {/* Language Tools - Code Actions, Refactoring, Quick Fixes */}
      <LanguageTools
        editor={currentEditor()}
        monaco={currentMonaco()}
        uri={currentUri()}
      />
      {/* Git Gutter Decorations - QuickDiff indicators */}
      <GitGutterDecorations
        editor={currentEditor()}
        monaco={currentMonaco()}
        filePath={currentFilePathMemo()}
      />
      {/* Peek Definition Widget - Inline definition preview */}
      <PeekWidget
        editor={currentEditor()}
        monaco={currentMonaco()}
        onNavigate={(location) => {
          // Navigate to the definition file
          const filePath = location.uri
            .replace(/^file:\/\//, "")
            .replace(/\//g, "\\");
          window.dispatchEvent(
            new CustomEvent("editor:openFile", {
              detail: {
                path: filePath,
                line: location.range.startLineNumber,
                column: location.range.startColumn,
              },
            }),
          );
        }}
      />
      {/* Peek References Widget - Inline references preview */}
      <PeekReferences
        editor={currentEditor()}
        monaco={currentMonaco()}
        onNavigate={(uri, line, column) => {
          // Navigate to the reference file
          const filePath = uri.replace(/^file:\/\//, "").replace(/\//g, "\\");
          window.dispatchEvent(
            new CustomEvent("editor:openFile", {
              detail: {
                path: filePath,
                line: line,
                column: column,
              },
            }),
          );
        }}
      />
      {/* Find/Replace Widget - Advanced search and replace with regex support */}
      <FindReplaceWidget
        editor={currentEditor()}
        monaco={currentMonaco()}
        initialOpen={findReplaceOpen()}
        initialShowReplace={findReplaceShowReplace()}
        onClose={() => {
          setFindReplaceOpen(false);
          setFindReplaceShowReplace(false);
        }}
        onMatchesChange={(count, current) => {
          // Emit event for status bar or other components that need match info
          window.dispatchEvent(
            new CustomEvent("editor:find-matches-change", {
              detail: { count, current },
            }),
          );
        }}
      />
      {/* Rename Widget - F2 symbol renaming with LSP integration */}
      <RenameWidget
        editor={currentEditor()}
        monaco={currentMonaco()}
        serverId={currentLanguage()}
        onClose={() => {
          // Widget closed, refocus editor
          currentEditor()?.focus();
        }}
        onRename={(
          oldName: string,
          newName: string,
          locations: RenameLocation[],
        ) => {
          // Rename completed successfully
          console.debug(
            `[RenameWidget] Renamed "${oldName}" to "${newName}" in ${locations.length} locations`,
          );
          // Trigger file content refresh for affected files
          window.dispatchEvent(
            new CustomEvent("editor:refresh-content", {
              detail: { locations },
            }),
          );
        }}
      />
      {/* Parameter Hints Widget - Function signature help on '(' and ',' */}
      <ParameterHintsWidget
        editor={currentEditor()}
        monaco={currentMonaco()}
        signatureHelp={parameterHints.signatureHelp()}
        onClose={parameterHints.onClose}
        onRequestSignatureHelp={async (position, triggerChar, isRetrigger) => {
          await getSignatureHelpFromLSP(position, triggerChar, isRetrigger);
        }}
      />
      {/* ============================================================================
          Debug Widgets - Conditional rendering when debug session is active
          ============================================================================ */}
      {/* Debug Hover Widget - Rich variable inspection during debugging */}
      <Show when={debug.state.isPaused && debug.state.activeSessionId}>
        <DebugHoverWidget
          state={debugHover.state()}
          onClose={debugHover.hideHover}
          onToggleExpand={debugHover.toggleExpand}
          onLoadChildren={debugHover.loadChildren}
          onAddToWatch={debugHover.addToWatch}
        />
      </Show>
      {/* Inline Values Decorations - Show variable values inline during debugging */}
      <Show when={debug.state.isPaused && debug.state.inlineValuesEnabled}>
        <InlineValuesOverlay
          editor={currentEditor()}
          filePath={currentFilePathMemo()}
          settings={{
            enabled: debug.state.inlineValuesEnabled,
            maxValueLength: 50,
            showTypes: true,
            debounceMs: 100,
          }}
        />
      </Show>
      {/* Exception Widget - Shows exception details at the line where exception occurred */}
      <Show
        when={debug.state.isPaused && debug.getExceptionWidgetState().visible}
      >
        <ExceptionWidget
          lineHeight={20}
          editorTopOffset={0}
          onContinue={() => debug.continue_()}
          onConfigureBreakpoint={(exceptionId) => {
            editorLogger.debug(
              "Configure breakpoint for exception:",
              exceptionId,
            );
          }}
        />
      </Show>
      {/* Light Bulb Widget - Shows code actions indicator in glyph margin */}
      <LightBulbWidget
        editor={currentEditor()}
        monaco={currentMonaco()}
        uri={currentUri()}
      />
    </div>
  );
}
