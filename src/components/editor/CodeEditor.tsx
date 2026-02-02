import { Show, createEffect, onMount, onCleanup, createSignal, createMemo } from "solid-js";
import { useEditor, OpenFile } from "@/context/EditorContext";
import { useVim } from "@/context/VimContext";
import { useSettings } from "@/context/SettingsContext";
import { useTesting, LineCoverageData, LineCoverageStatus } from "@/context/TestingContext";
import { useDebug, InlineValueInfo } from "@/context/DebugContext";
import { useCollabEditor } from "@/hooks/useCollabEditor";
import { useSnippetCompletions } from "@/hooks/useSnippetCompletions";
import { editorLogger } from "../../utils/logger";
import type * as Monaco from "monaco-editor";
import { VimMode } from "./VimMode";
import { LanguageTools } from "./LanguageTools";
import { EditorSkeleton } from "./EditorSkeleton";
import { GitGutterDecorations, goToNextChange, goToPrevChange } from "./GitGutterDecorations";
import { MonacoManager, LARGE_FILE_THRESHOLDS, type LargeFileSettings } from "@/utils/monacoManager";
import { invoke } from "@tauri-apps/api/core";
import { balanceInward, balanceOutward, wrapWithAbbreviation, getSelectionForWrap, expandEmmetAbbreviation, getAbbreviationRange } from "@/utils/emmet";
import { 
  InlineBlameManager, 
  InlineBlameMode, 
  getInlineBlameMode, 
  setInlineBlameMode, 
  toggleInlineBlame 
} from "./InlineBlame";
import { PeekWidget, showPeekWidget, hidePeekWidget, type PeekLocation } from "./PeekWidget";
import { PeekReferences, showPeekReferences } from "./PeekReferences";
import { showReferencesPanel } from "../ReferencesPanel";
import { FindReplaceWidget } from "./FindReplaceWidget";
import { StickyScrollWidget } from "./StickyScrollWidget";
import { RenameWidget, showRenameWidget } from "./RenameWidget";
import type { RenameLocation } from "@/types/editor";
import { DebugHoverWidget, useDebugHover } from "../debug/DebugHoverWidget";
import { InlineValuesOverlay } from "../debug/InlineValuesDecorations";
import { ExceptionWidget } from "../debug/ExceptionWidget";
import { ParameterHintsWidget, useParameterHints } from "./ParameterHintsWidget";
import type { SignatureHelp, Position as LSPPosition } from "@/context/LSPContext";
import { LightBulbWidget } from "./LightBulbWidget";

// ============================================================================
// Performance Utilities
// ============================================================================

/** Extended Window interface with requestIdleCallback */
interface WindowWithIdleCallback {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number;
}

/**
 * Yields to the main thread to prevent blocking UI.
 * Uses requestIdleCallback if available, falls back to setTimeout.
 */
const yieldToMain = (): Promise<void> => {
  return new Promise((resolve) => {
    const win = window as WindowWithIdleCallback;
    if (win.requestIdleCallback) {
      win.requestIdleCallback(() => resolve(), { timeout: 16 });
    } else {
      setTimeout(resolve, 0);
    }
  });
};

/**
 * Executes an array of functions in batches, yielding to main thread between batches.
 * This prevents long-running synchronous operations from blocking the UI.
 * @internal Reserved for future use in progressive loading of large files
 */
// @ts-expect-error Reserved for future use
const _executeBatched = async (tasks: (() => void)[], batchSize: number = 10): Promise<void> => {
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    batch.forEach(task => task());
    if (i + batchSize < tasks.length) {
      await yieldToMain();
    }
  }
};

/**
 * Creates a debounced version of a function that delays invocation until after
 * `wait` milliseconds have elapsed since the last call.
 * @internal Reserved for future use in debouncing user input
 */
// @ts-expect-error Reserved for future use
function _debounce<T extends (...args: unknown[]) => void>(fn: T, wait: number): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const debounced = ((...args: unknown[]) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, wait);
  }) as T & { cancel: () => void };
  
  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return debounced;
}

/**
 * Track whether LSP providers have been registered globally.
 * This prevents duplicate registrations across editor instances.
 */
let providersRegistered = false;

/**
 * Fast line count estimation for large files.
 * Uses a sampling approach for files over 100KB to avoid blocking.
 */
function estimateLineCount(content: string): number {
  const length = content.length;
  
  // For small files (< 100KB), count directly - it's fast enough
  if (length < 100000) {
    let count = 1;
    for (let i = 0; i < length; i++) {
      if (content.charCodeAt(i) === 10) count++;
    }
    return count;
  }
  
  // For larger files, sample to estimate
  const sampleSize = 10000;
  let newlines = 0;
  for (let i = 0; i < sampleSize && i < length; i++) {
    if (content.charCodeAt(i) === 10) newlines++;
  }
  
  // Estimate based on sample ratio
  if (newlines === 0) return 1;
  const avgBytesPerLine = sampleSize / newlines;
  return Math.ceil(length / avgBytesPerLine);
}

/**
 * Cache for editor base options to avoid recreation on every file switch.
 * Invalidated when settings change.
 * @internal Reserved for future use in options caching
 */
// @ts-expect-error Reserved for future use
let _cachedBaseOptions: Monaco.editor.IStandaloneEditorConstructionOptions | null = null;
// @ts-expect-error Reserved for future use
let _cachedSettingsVersion = 0;

// ============================================================================
// Text Transform Utilities
// ============================================================================

/**
 * Convert a string to snake_case
 * Examples: "camelCase" -> "camel_case", "PascalCase" -> "pascal_case", "kebab-case" -> "kebab_case"
 */
const toSnakeCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
};

/**
 * Convert a string to camelCase
 * Examples: "snake_case" -> "snakeCase", "kebab-case" -> "kebabCase", "PascalCase" -> "pascalCase"
 */
const toCamelCase = (str: string): string => {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^[A-Z]/, c => c.toLowerCase());
};

/**
 * Convert a string to PascalCase
 * Examples: "snake_case" -> "SnakeCase", "kebab-case" -> "KebabCase", "camelCase" -> "CamelCase"
 */
const toPascalCase = (str: string): string => {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^[a-z]/, c => c.toUpperCase());
};

/**
 * Convert a string to kebab-case
 * Examples: "camelCase" -> "camel-case", "PascalCase" -> "pascal-case", "snake_case" -> "snake-case"
 */
const toKebabCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
};

/**
 * Convert a string to CONSTANT_CASE
 * Examples: "camelCase" -> "CAMEL_CASE", "kebab-case" -> "KEBAB_CASE"
 */
const toConstantCase = (str: string): string => {
  return toSnakeCase(str).toUpperCase();
};

// ============================================================================
// Inlay Hints Types (LSP Specification)
// ============================================================================

/** A label part for complex inlay hint labels */
interface InlayHintLabelPart {
  value: string;
  tooltip?: string;
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
}

/** LSP Inlay Hint response structure */
interface LSPInlayHint {
  position: { line: number; character: number };
  label: string | InlayHintLabelPart[];
  kind?: 1 | 2; // 1 = Type, 2 = Parameter
  tooltip?: string;
  paddingLeft?: boolean;
  paddingRight?: boolean;
  textEdits?: Array<{
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    newText: string;
  }>;
  data?: unknown;
}

/** LSP Inlay Hints response */
interface LSPInlayHintsResponse {
  hints: LSPInlayHint[];
}

// ============================================================================
// Format on Type Types (LSP Specification)
// ============================================================================

/** LSP TextEdit for formatting */
interface LSPTextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

/** LSP Document On Type Formatting response */
interface LSPOnTypeFormattingResponse {
  edits: LSPTextEdit[] | null;
}

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
  private lastPosition: Map<string, { line: number; column: number }> = new Map();
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
  private hasPositionChanged(uri: string, currentPos: { line: number; column: number }): boolean {
    const key = this.getEditorKey(uri);
    const lastPos = this.lastPosition.get(key);
    if (!lastPos) return true;
    return lastPos.line !== currentPos.line || lastPos.column !== currentPos.column;
  }

  /**
   * Update the tracked position
   */
  private updatePosition(uri: string, pos: { line: number; column: number }): void {
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
    if (lastRange && 
        lastRange.startLineNumber === range.startLineNumber &&
        lastRange.startColumn === range.startColumn &&
        lastRange.endLineNumber === range.endLineNumber &&
        lastRange.endColumn === range.endColumn) {
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
    position: { line: number; character: number }
  ): Promise<LSPSelectionRange[] | null> {
    const key = this.getEditorKey(uri);
    const now = Date.now();
    const cachedTimestamp = this.cacheTimestamps.get(key);
    
    // Use cache if valid
    if (cachedTimestamp && (now - cachedTimestamp) < this.CACHE_TTL_MS) {
      return this.cachedRanges.get(key) || null;
    }

    try {
      const response = await invoke<LSPSelectionRangeResponse>('lsp_selection_range', {
        params: {
          uri,
          positions: [position],
        },
      });

      if (response?.ranges && response.ranges.length > 0) {
        this.cachedRanges.set(key, response.ranges);
        this.cacheTimestamps.set(key, now);
        return response.ranges;
      }
    } catch (error) {
      console.debug('LSP selection range not available:', error);
    }

    return null;
  }

  /**
   * Convert LSP SelectionRange to flat array of Monaco ranges (from innermost to outermost)
   */
  private flattenSelectionRanges(lspRange: LSPSelectionRange, _monaco: typeof Monaco): Monaco.IRange[] {
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
    availableRanges: Monaco.IRange[]
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
    monaco: typeof Monaco
  ): Promise<void> {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return;

    const uri = model.uri.toString();
    const position = selection.getPosition();

    // Check if position changed - reset history if so
    if (this.hasPositionChanged(uri, { line: position.lineNumber, column: position.column })) {
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
        flatRanges
      );

      if (nextRange) {
        editor.setSelection(new monaco.Selection(
          nextRange.startLineNumber,
          nextRange.startColumn,
          nextRange.endLineNumber,
          nextRange.endColumn
        ));
        this.pushToHistory(uri, nextRange);
        this.updatePosition(uri, { line: position.lineNumber, column: position.column });
        return;
      }
    }

    // Fall back to Monaco's built-in smart select
    editor.trigger('smartSelect', 'editor.action.smartSelect.expand', null);
    
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
    this.updatePosition(uri, { line: position.lineNumber, column: position.column });
  }

  /**
   * Shrink selection - goes from larger to smaller scope (reverse of expand)
   */
  shrinkSelection(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ): void {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return;

    const uri = model.uri.toString();
    
    // Try to pop from our history first
    const previousRange = this.popFromHistory(uri);
    
    if (previousRange) {
      editor.setSelection(new monaco.Selection(
        previousRange.startLineNumber,
        previousRange.startColumn,
        previousRange.endLineNumber,
        previousRange.endColumn
      ));
      return;
    }

    // Fall back to Monaco's built-in smart select shrink
    editor.trigger('smartSelect', 'editor.action.smartSelect.shrink', null);
  }
}

/** Global Smart Select Manager instance */
const smartSelectManager = new SmartSelectManager();

/** Format on Type settings */
interface FormatOnTypeSettings {
  enabled: boolean;
  triggerCharacters: string[];
}

/** Default format on type settings */
const defaultFormatOnTypeSettings: FormatOnTypeSettings = {
  enabled: false,
  triggerCharacters: [";", "}", "\n"],
};

/** Global format on type settings state */
let formatOnTypeSettings: FormatOnTypeSettings = { ...defaultFormatOnTypeSettings };

/** Track registered on type formatting provider disposable for cleanup */
let onTypeFormattingProviderDisposable: Monaco.IDisposable | null = null;

/** Track registered CodeLens provider disposables for cleanup */
let codeLensProviderDisposables: Monaco.IDisposable[] = [];

/** Track registered Semantic Tokens provider disposables for cleanup */
let semanticTokensProviderDisposables: Monaco.IDisposable[] = [];

// ============================================================================
// CodeLens Types (LSP Specification)
// ============================================================================

/** LSP CodeLens response structure */
interface LSPCodeLens {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
  data?: unknown;
}

/** LSP CodeLens result */
interface LSPCodeLensResult {
  lenses: LSPCodeLens[];
}

// ============================================================================
// Semantic Tokens Types (LSP Specification)
// ============================================================================

/** LSP Semantic Tokens result */
interface LSPSemanticTokensResult {
  data: number[];
  resultId?: string;
}

/** Inlay hints configuration settings */
interface InlayHintSettings {
  enabled: 'on' | 'off' | 'onUnlessPressed' | 'offUnlessPressed';
  fontSize: number;
  fontFamily: string;
  showParameterNames: boolean;
  showTypeHints: boolean;
  showReturnTypes: boolean;
}

/** Default inlay hints settings matching Ayu Dark aesthetics */
const defaultInlayHintSettings: InlayHintSettings = {
  enabled: 'on',
  fontSize: 12,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, monospace",
  showParameterNames: true,
  showTypeHints: true,
  showReturnTypes: true,
};

/** Global inlay hints settings state */
let inlayHintSettings: InlayHintSettings = { ...defaultInlayHintSettings };

/** Track registered inlay hints provider disposable for cleanup */
let inlayHintsProviderDisposable: Monaco.IDisposable | null = null;

/** Track registered linked editing range provider disposables for cleanup */
let linkedEditingProviderDisposables: Monaco.IDisposable[] = [];

/** Global linked editing settings state */
let linkedEditingEnabled = true;

// ============================================================================
// Unicode Highlighting Types and Utilities
// ============================================================================

/** Unicode highlight settings matching Monaco's unicodeHighlight option */
interface UnicodeHighlightSettings {
  enabled: boolean;
  invisibleCharacters: boolean;
  ambiguousCharacters: boolean;
  nonBasicASCII: boolean;
  includeComments: boolean | "inUntrustedWorkspace";
  includeStrings: boolean | "inUntrustedWorkspace";
  allowedCharacters: Record<string, boolean>;
  allowedLocales: Record<string, boolean>;
}

/** Default unicode highlight settings */
const defaultUnicodeHighlightSettings: UnicodeHighlightSettings = {
  enabled: true,
  invisibleCharacters: true,
  ambiguousCharacters: true,
  nonBasicASCII: false,
  includeComments: "inUntrustedWorkspace",
  includeStrings: true,
  allowedCharacters: {},
  allowedLocales: { _os: true, _vscode: true },
};

/** Global unicode highlight settings state */
let unicodeHighlightSettings: UnicodeHighlightSettings = { ...defaultUnicodeHighlightSettings };

/** Track registered unicode hover provider disposable for cleanup */
let unicodeHoverProviderDisposable: Monaco.IDisposable | null = null;

/** Track registered unicode code action provider disposable for cleanup */
let unicodeCodeActionProviderDisposable: Monaco.IDisposable | null = null;

/**
 * Map of commonly confused Unicode characters (homoglyphs) to their ASCII equivalents.
 * This covers Cyrillic, Greek, and other look-alike characters.
 */
const UNICODE_TO_ASCII_MAP: Record<string, string> = {
  // Cyrillic homoglyphs
  "\u0410": "A", "\u0412": "B", "\u0421": "C", "\u0415": "E", "\u041D": "H",
  "\u0406": "I", "\u041A": "K", "\u041C": "M", "\u041E": "O", "\u0420": "P",
  "\u0422": "T", "\u0425": "X", "\u0430": "a", "\u0435": "e", "\u043E": "o",
  "\u0440": "p", "\u0441": "c", "\u0443": "y", "\u0445": "x", "\u0456": "i",
  "\u0458": "j", "\u04BB": "h",
  // Greek homoglyphs
  "\u0391": "A", "\u0392": "B", "\u0395": "E", "\u0396": "Z", "\u0397": "H",
  "\u0399": "I", "\u039A": "K", "\u039C": "M", "\u039D": "N", "\u039F": "O",
  "\u03A1": "P", "\u03A4": "T", "\u03A5": "Y", "\u03A7": "X", "\u03BF": "o",
  "\u03B1": "a",
  // Invisible/special characters
  "\u00A0": " ", "\u2000": " ", "\u2001": " ", "\u2002": " ", "\u2003": " ",
  "\u2004": " ", "\u2005": " ", "\u2006": " ", "\u2007": " ", "\u2008": " ",
  "\u2009": " ", "\u200A": " ", "\u200B": "", "\u200C": "", "\u200D": "",
  "\u200E": "", "\u200F": "", "\u2028": "\n", "\u2029": "\n", "\u202A": "",
  "\u202B": "", "\u202C": "", "\u202D": "", "\u202E": "", "\u2060": "",
  "\u2061": "", "\u2062": "", "\u2063": "", "\u2064": "", "\uFEFF": "",
  // Common confusables (dashes, quotes, etc.)
  "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-",
  "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u201B": "'",
  "\u201C": '"', "\u201D": '"', "\u201E": '"', "\u201F": '"',
  "\u2024": ".", "\u2025": "..", "\u2026": "...", "\u2032": "'", "\u2033": '"',
  "\u2039": "<", "\u203A": ">", "\u2044": "/", "\u2215": "/", "\u2216": "\\",
  "\u2217": "*", "\u2218": "o", "\u2219": ".", "\u22C5": ".",
  // Fullwidth characters
  "\uFF01": "!", "\uFF02": '"', "\uFF03": "#", "\uFF04": "$", "\uFF05": "%",
  "\uFF06": "&", "\uFF07": "'", "\uFF08": "(", "\uFF09": ")", "\uFF0A": "*",
  "\uFF0B": "+", "\uFF0C": ",", "\uFF0D": "-", "\uFF0E": ".", "\uFF0F": "/",
  "\uFF1A": ":", "\uFF1B": ";", "\uFF1C": "<", "\uFF1D": "=", "\uFF1E": ">",
  "\uFF1F": "?", "\uFF20": "@", "\uFF3B": "[", "\uFF3C": "\\", "\uFF3D": "]",
  "\uFF3E": "^", "\uFF3F": "_", "\uFF40": "`", "\uFF5B": "{", "\uFF5C": "|",
  "\uFF5D": "}", "\uFF5E": "~",
};

/** Get Unicode character category and description */
function getUnicodeCharacterInfo(char: string): {
  codePoint: string;
  name: string;
  category: "invisible" | "homoglyph" | "bidirectional" | "nonBasicASCII" | "unknown";
  replacement?: string;
} {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    return { codePoint: "U+????", name: "Unknown", category: "unknown" };
  }

  const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
  const codePointStr = `U+${hex}`;

  // Invisible characters
  if (
    (codePoint >= 0x200B && codePoint <= 0x200F) ||
    (codePoint >= 0x202A && codePoint <= 0x202E) ||
    (codePoint >= 0x2060 && codePoint <= 0x2064) ||
    codePoint === 0xFEFF || codePoint === 0x00A0 ||
    (codePoint >= 0x2000 && codePoint <= 0x200A) ||
    codePoint === 0x2028 || codePoint === 0x2029
  ) {
    const invisibleNames: Record<number, string> = {
      0x200B: "Zero Width Space", 0x200C: "Zero Width Non-Joiner",
      0x200D: "Zero Width Joiner", 0x200E: "Left-to-Right Mark",
      0x200F: "Right-to-Left Mark", 0x202A: "Left-to-Right Embedding",
      0x202B: "Right-to-Left Embedding", 0x202C: "Pop Directional Formatting",
      0x202D: "Left-to-Right Override", 0x202E: "Right-to-Left Override",
      0x2060: "Word Joiner", 0xFEFF: "Byte Order Mark",
      0x00A0: "Non-Breaking Space", 0x2028: "Line Separator",
      0x2029: "Paragraph Separator",
    };
    return {
      codePoint: codePointStr,
      name: invisibleNames[codePoint] || "Invisible Character",
      category: "invisible",
      replacement: UNICODE_TO_ASCII_MAP[char],
    };
  }

  // Bidirectional control characters
  if (
    (codePoint >= 0x202A && codePoint <= 0x202E) ||
    codePoint === 0x200E || codePoint === 0x200F ||
    codePoint === 0x061C || (codePoint >= 0x2066 && codePoint <= 0x2069)
  ) {
    return {
      codePoint: codePointStr,
      name: "Bidirectional Control Character",
      category: "bidirectional",
      replacement: UNICODE_TO_ASCII_MAP[char] ?? "",
    };
  }

  // Homoglyphs
  const replacement = UNICODE_TO_ASCII_MAP[char];
  if (replacement !== undefined) {
    let scriptName = "Unicode";
    if (codePoint >= 0x0400 && codePoint <= 0x04FF) scriptName = "Cyrillic";
    else if (codePoint >= 0x0370 && codePoint <= 0x03FF) scriptName = "Greek";
    else if (codePoint >= 0xFF00 && codePoint <= 0xFFEF) scriptName = "Fullwidth";
    else if (codePoint >= 0x2010 && codePoint <= 0x2027) scriptName = "General Punctuation";

    return {
      codePoint: codePointStr,
      name: `${scriptName} character resembling "${replacement}"`,
      category: "homoglyph",
      replacement,
    };
  }

  // Non-basic ASCII
  if (codePoint < 0x20 || codePoint > 0x7E) {
    return { codePoint: codePointStr, name: "Non-Basic ASCII Character", category: "nonBasicASCII" };
  }

  return { codePoint: codePointStr, name: char, category: "unknown" };
}

/** Check if character should be highlighted based on settings */
function shouldHighlightCharacter(char: string, settings: UnicodeHighlightSettings): boolean {
  if (!settings.enabled) return false;
  const info = getUnicodeCharacterInfo(char);
  if (settings.allowedCharacters[char]) return false;

  switch (info.category) {
    case "invisible": return settings.invisibleCharacters;
    case "homoglyph": return settings.ambiguousCharacters;
    case "bidirectional": return settings.invisibleCharacters;
    case "nonBasicASCII": return settings.nonBasicASCII;
    default: return false;
  }
}

/** Find all confusable Unicode characters in text */
function findConfusableCharacters(
  text: string,
  settings: UnicodeHighlightSettings
): Array<{ char: string; index: number; info: ReturnType<typeof getUnicodeCharacterInfo> }> {
  const results: Array<{ char: string; index: number; info: ReturnType<typeof getUnicodeCharacterInfo> }> = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (shouldHighlightCharacter(char, settings)) {
      results.push({ char, index: i, info: getUnicodeCharacterInfo(char) });
    }
  }
  return results;
}

/** Update unicode highlight settings */
function updateUnicodeHighlightSettings(settings: Partial<UnicodeHighlightSettings>): void {
  unicodeHighlightSettings = { ...unicodeHighlightSettings, ...settings };
}

/** Format category for display */
function formatUnicodeCategory(category: string): string {
  switch (category) {
    case "invisible": return "Invisible/Whitespace";
    case "homoglyph": return "Confusable (Homoglyph)";
    case "bidirectional": return "Bidirectional Control";
    case "nonBasicASCII": return "Non-Basic ASCII";
    default: return category;
  }
}

/** Register hover provider for unicode character information */
function registerUnicodeHoverProvider(monaco: typeof Monaco): void {
  if (unicodeHoverProviderDisposable) {
    unicodeHoverProviderDisposable?.dispose?.();
    unicodeHoverProviderDisposable = null;
  }

  unicodeHoverProviderDisposable = monaco.languages.registerHoverProvider("*", {
    provideHover(model: Monaco.editor.ITextModel, position: Monaco.Position): Monaco.languages.ProviderResult<Monaco.languages.Hover> {
      if (!unicodeHighlightSettings.enabled) return null;

      const lineContent = model.getLineContent(position.lineNumber);
      const column = position.column - 1;
      if (column < 0 || column >= lineContent.length) return null;

      const char = lineContent[column];
      if (!shouldHighlightCharacter(char, unicodeHighlightSettings)) return null;

      const info = getUnicodeCharacterInfo(char);
      let content = `**Unicode Character Detected**\n\n`;
      content += `- **Code Point:** \`${info.codePoint}\`\n`;
      content += `- **Description:** ${info.name}\n`;
      content += `- **Category:** ${formatUnicodeCategory(info.category)}\n`;

      if (info.replacement !== undefined) {
        const displayReplacement = info.replacement === "" ? "(remove)" : `"${info.replacement}"`;
        content += `- **ASCII Equivalent:** ${displayReplacement}\n`;
      }

      content += "\n---\n";
      switch (info.category) {
        case "invisible":
          content += "⚠️ This invisible character may cause unexpected behavior.";
          break;
        case "homoglyph":
          content += "⚠️ This character resembles ASCII but is different. Could be used for spoofing.";
          break;
        case "bidirectional":
          content += "⚠️ Bidirectional control can make text appear different from logical order.";
          break;
        case "nonBasicASCII":
          content += "ℹ️ Non-ASCII character may not display correctly everywhere.";
          break;
      }

      return {
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1),
        contents: [{ value: content }],
      };
    },
  });
}

/** Register code action provider for unicode quick fixes */
function registerUnicodeCodeActionProvider(monaco: typeof Monaco): void {
  if (unicodeCodeActionProviderDisposable) {
    unicodeCodeActionProviderDisposable?.dispose?.();
    unicodeCodeActionProviderDisposable = null;
  }

  unicodeCodeActionProviderDisposable = monaco.languages.registerCodeActionProvider("*", {
    provideCodeActions(
      model: Monaco.editor.ITextModel,
      range: Monaco.Range,
      _context: Monaco.languages.CodeActionContext
    ): Monaco.languages.ProviderResult<Monaco.languages.CodeActionList> {
      if (!unicodeHighlightSettings.enabled) {
        return { actions: [], dispose: () => {} };
      }

      const actions: Monaco.languages.CodeAction[] = [];
      const text = model.getValueInRange(range);
      let confusables = findConfusableCharacters(text, unicodeHighlightSettings);

      // Check single character at cursor if no selection
      if (confusables.length === 0 && range.startLineNumber === range.endLineNumber && range.startColumn === range.endColumn) {
        const lineContent = model.getLineContent(range.startLineNumber);
        const column = range.startColumn - 1;
        if (column >= 0 && column < lineContent.length) {
          const char = lineContent[column];
          if (shouldHighlightCharacter(char, unicodeHighlightSettings)) {
            const info = getUnicodeCharacterInfo(char);
            if (info.replacement !== undefined) {
              confusables = [{ char, index: 0, info }];
            }
          }
        }
      }

      // Create single character replacement actions
      for (const confusable of confusables) {
        if (confusable.info.replacement !== undefined) {
          const startColumn = range.startColumn + confusable.index;
          const editRange = new monaco.Range(range.startLineNumber, startColumn, range.startLineNumber, startColumn + 1);
          const replacementDisplay = confusable.info.replacement === "" ? "Remove character" : `Replace with "${confusable.info.replacement}"`;

          actions.push({
            title: `${replacementDisplay} (${confusable.info.codePoint})`,
            kind: "quickfix",
            diagnostics: [],
            edit: {
              edits: [{
                resource: model.uri,
                textEdit: { range: editRange, text: confusable.info.replacement },
                versionId: model.getVersionId(),
              }],
            },
            isPreferred: true,
          });
        }
      }

      // Bulk replace in selection
      if (confusables.length > 1) {
        let replacedText = text;
        for (let i = confusables.length - 1; i >= 0; i--) {
          const c = confusables[i];
          if (c.info.replacement !== undefined) {
            replacedText = replacedText.substring(0, c.index) + c.info.replacement + replacedText.substring(c.index + 1);
          }
        }
        actions.push({
          title: `Replace all ${confusables.length} confusable characters`,
          kind: "quickfix",
          diagnostics: [],
          edit: {
            edits: [{ resource: model.uri, textEdit: { range, text: replacedText }, versionId: model.getVersionId() }],
          },
        });
      }

      // Replace all in document
      const fullText = model.getValue();
      const allConfusables = findConfusableCharacters(fullText, unicodeHighlightSettings);
      if (allConfusables.length > 0) {
        let fullReplacedText = fullText;
        for (let i = allConfusables.length - 1; i >= 0; i--) {
          const c = allConfusables[i];
          if (c.info.replacement !== undefined) {
            fullReplacedText = fullReplacedText.substring(0, c.index) + c.info.replacement + fullReplacedText.substring(c.index + 1);
          }
        }
        actions.push({
          title: `Replace all ${allConfusables.length} confusable characters in document`,
          kind: "quickfix",
          diagnostics: [],
          edit: {
            edits: [{ resource: model.uri, textEdit: { range: model.getFullModelRange(), text: fullReplacedText }, versionId: model.getVersionId() }],
          },
        });
      }

      return { actions, dispose: () => {} };
    },
  });
}

// ============================================================================
// Test Coverage Decoration Types and State
// ============================================================================

/** Track coverage decorations for cleanup */
let coverageDecorations: string[] = [];

/** Coverage decoration colors */
const COVERAGE_COLORS = {
  covered: "var(--cortex-syntax-function)",    // Green - line is fully covered
  uncovered: "var(--cortex-error)",  // Red - line is not covered
  partial: "var(--cortex-warning)",    // Yellow - line has partial branch coverage
} as const;

/** Coverage glyph margin classes */
const COVERAGE_GLYPH_CLASSES = {
  covered: "coverage-glyph-covered",
  uncovered: "coverage-glyph-uncovered",
  partial: "coverage-glyph-partial",
} as const;

/**
 * Create Monaco decoration options for a coverage line
 */
function createCoverageDecoration(
  lineNumber: number,
  status: LineCoverageStatus,
  hits: number,
  branches?: { covered: number; total: number },
  monaco?: typeof Monaco
): Monaco.editor.IModelDeltaDecoration | null {
  if (!monaco) return null;

  const color = COVERAGE_COLORS[status];
  const glyphClass = COVERAGE_GLYPH_CLASSES[status];

  // Build hover message content
  let hoverMessage = "";
  if (status === "covered") {
    hoverMessage = `✓ Covered (${hits} hit${hits !== 1 ? "s" : ""})`;
  } else if (status === "uncovered") {
    hoverMessage = "✗ Not covered";
  } else if (status === "partial" && branches) {
    hoverMessage = `◐ Partial coverage: ${branches.covered}/${branches.total} branches (${hits} hit${hits !== 1 ? "s" : ""})`;
  }

  return {
    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
    options: {
      isWholeLine: true,
      glyphMarginClassName: glyphClass,
      glyphMarginHoverMessage: { value: hoverMessage },
      overviewRuler: {
        color: color,
        position: monaco.editor.OverviewRulerLane.Left,
      },
      minimap: {
        color: color,
        position: monaco.editor.MinimapPosition.Gutter,
      },
    },
  };
}

/**
 * Apply coverage decorations to an editor
 */
function applyCoverageDecorations(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  coverageLines: LineCoverageData[]
): void {
  const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

  for (const line of coverageLines) {
    const decoration = createCoverageDecoration(
      line.lineNumber,
      line.status,
      line.hits,
      line.branches,
      monaco
    );
    if (decoration) {
      newDecorations.push(decoration);
    }
  }

  // Use deltaDecorations to efficiently update decorations
  coverageDecorations = editor.deltaDecorations(coverageDecorations, newDecorations);
}

/**
 * Clear all coverage decorations from an editor
 */
function clearCoverageDecorations(editor: Monaco.editor.IStandaloneCodeEditor): void {
  coverageDecorations = editor.deltaDecorations(coverageDecorations, []);
}

let monacoInstance: typeof Monaco | null = null;

// Store event listeners for cleanup
const eventCleanupFns: (() => void)[] = [];

// Inline blame manager instance
let inlineBlameManager: InlineBlameManager | null = null;

/**
 * Register inlay hints provider for all supported languages.
 * Integrates with LSP to fetch type hints, parameter names, and return types.
 * Falls back gracefully when LSP is not available.
 */
function registerInlayHintsProvider(monaco: typeof Monaco): void {
  // Dispose previous provider if exists
  if (inlayHintsProviderDisposable) {
    inlayHintsProviderDisposable?.dispose?.();
    inlayHintsProviderDisposable = null;
  }

  // Languages that commonly support inlay hints via LSP
  const supportedLanguages = [
    'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
    'rust', 'go', 'python', 'java', 'kotlin', 'c', 'cpp', 'csharp'
  ];

  // Register provider for each supported language
  const disposables: Monaco.IDisposable[] = [];

  for (const language of supportedLanguages) {
    const disposable = monaco.languages.registerInlayHintsProvider(language, {
      provideInlayHints: async (
        model: Monaco.editor.ITextModel,
        range: Monaco.Range,
        _token: Monaco.CancellationToken
      ): Promise<Monaco.languages.InlayHintList> => {
        // Check if inlay hints are enabled via settings
        if (inlayHintSettings.enabled === 'off') {
          return { hints: [], dispose: () => {} };
        }

        const uri = model.uri.toString();
        
        try {
          // Request inlay hints from LSP backend
          const response = await invoke<LSPInlayHintsResponse>('lsp_inlay_hints', {
            params: {
              uri,
              range: {
                start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
                end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
              },
            },
          });

          if (!response || !response.hints || response.hints.length === 0) {
            return { hints: [], dispose: () => {} };
          }

          // Convert LSP inlay hints to Monaco format
          const monacoHints: Monaco.languages.InlayHint[] = response.hints
            .filter((hint) => {
              // Filter based on settings
              const isTypeHint = hint.kind === 1;
              const isParameterHint = hint.kind === 2;
              
              if (isTypeHint && !inlayHintSettings.showTypeHints) return false;
              if (isParameterHint && !inlayHintSettings.showParameterNames) return false;
              
              return true;
            })
            .map((hint) => {
              // Extract label text
              const labelText = typeof hint.label === 'string'
                ? hint.label
                : hint.label.map((part) => part.value).join('');

              // Determine hint kind for Monaco
              let monacoKind: Monaco.languages.InlayHintKind;
              if (hint.kind === 1) {
                monacoKind = monaco.languages.InlayHintKind.Type;
              } else if (hint.kind === 2) {
                monacoKind = monaco.languages.InlayHintKind.Parameter;
              } else {
                monacoKind = monaco.languages.InlayHintKind.Type; // Default
              }

              // Build the Monaco inlay hint
              const monacoHint: Monaco.languages.InlayHint = {
                position: {
                  lineNumber: hint.position.line + 1,
                  column: hint.position.character + 1,
                },
                label: labelText,
                kind: monacoKind,
                paddingLeft: hint.paddingLeft ?? (hint.kind === 1), // Type hints typically have left padding
                paddingRight: hint.paddingRight ?? (hint.kind === 2), // Parameter hints typically have right padding
              };

              // Add tooltip if available
              if (hint.tooltip) {
                monacoHint.tooltip = hint.tooltip;
              }

              return monacoHint;
            });

          return {
            hints: monacoHints,
            dispose: () => {},
          };
        } catch (error) {
          // LSP not available or error - return empty hints (no fallback noise)
          // This is expected when LSP server doesn't support inlayHints
          console.debug('Inlay hints not available:', error);
          return { hints: [], dispose: () => {} };
        }
      },
    });

    disposables.push(disposable);
  }

  // Create a combined disposable
  inlayHintsProviderDisposable = {
    dispose: () => {
      disposables.forEach((d) => d?.dispose?.());
    },
  };
}

/**
 * Update inlay hints settings from external configuration changes.
 * Call this when settings are modified via UI or settings file.
 */
function updateInlayHintSettings(settings: Partial<InlayHintSettings>): void {
  inlayHintSettings = { ...inlayHintSettings, ...settings };
}

// ============================================================================
// Format on Type Provider
// ============================================================================

/**
 * Register on type formatting provider for all supported languages.
 * Integrates with LSP documentOnTypeFormattingProvider to format code
 * after specific trigger characters are typed.
 */
function registerOnTypeFormattingProvider(monaco: typeof Monaco): void {
  // Dispose previous provider if exists
  if (onTypeFormattingProviderDisposable) {
    onTypeFormattingProviderDisposable?.dispose?.();
    onTypeFormattingProviderDisposable = null;
  }

  // Languages that commonly support on type formatting via LSP
  const supportedLanguages = [
    'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
    'rust', 'go', 'python', 'java', 'kotlin', 'c', 'cpp', 'csharp',
    'json', 'html', 'css', 'scss', 'less'
  ];

  // Register provider for each supported language
  const disposables: Monaco.IDisposable[] = [];
  const triggerChars = formatOnTypeSettings.triggerCharacters;
  
  // Need at least one trigger character
  if (triggerChars.length === 0) return;

  for (const language of supportedLanguages) {
    const disposable = monaco.languages.registerOnTypeFormattingEditProvider(language, {
      autoFormatTriggerCharacters: triggerChars,
      provideOnTypeFormattingEdits: async (
        model: Monaco.editor.ITextModel,
        position: Monaco.Position,
        ch: string,
        options: Monaco.languages.FormattingOptions,
        _token: Monaco.CancellationToken
      ): Promise<Monaco.languages.TextEdit[]> => {
        // Check if format on type is enabled
        if (!formatOnTypeSettings.enabled) {
          return [];
        }

        // Check if this trigger character is in the configured list
        if (!formatOnTypeSettings.triggerCharacters.includes(ch)) {
          return [];
        }

        const uri = model.uri.toString();

        try {
          // Request on type formatting from LSP backend
          const response = await invoke<LSPOnTypeFormattingResponse>('lsp_on_type_formatting', {
            params: {
              uri,
              position: {
                line: position.lineNumber - 1,
                character: position.column - 1,
              },
              ch,
              options: {
                tabSize: options.tabSize,
                insertSpaces: options.insertSpaces,
              },
            },
          });

          if (!response || !response.edits || response.edits.length === 0) {
            return [];
          }

          // Convert LSP text edits to Monaco format
          const monacoEdits: Monaco.languages.TextEdit[] = response.edits.map((edit) => ({
            range: new monaco.Range(
              edit.range.start.line + 1,
              edit.range.start.character + 1,
              edit.range.end.line + 1,
              edit.range.end.character + 1
            ),
            text: edit.newText,
          }));

          return monacoEdits;
        } catch (error) {
          // LSP not available or error - return empty edits
          // This is expected when LSP server doesn't support onTypeFormatting
          console.debug('On type formatting not available:', error);
          return [];
        }
      },
    });

    disposables.push(disposable);
  }

  // Create a combined disposable
  onTypeFormattingProviderDisposable = {
    dispose: () => {
      disposables.forEach((d) => d?.dispose?.());
    },
  };
}

/**
 * Update format on type settings from external configuration changes.
 * Call this when settings are modified via UI or settings file.
 */
function updateFormatOnTypeSettings(settings: Partial<FormatOnTypeSettings>): void {
  const needsReregister = settings.triggerCharacters !== undefined &&
    JSON.stringify(settings.triggerCharacters) !== JSON.stringify(formatOnTypeSettings.triggerCharacters);
  
  formatOnTypeSettings = { ...formatOnTypeSettings, ...settings };
  
  // Re-register provider if trigger characters changed
  if (needsReregister && monacoInstance) {
    registerOnTypeFormattingProvider(monacoInstance);
  }
}

// ============================================================================
// CodeLens Provider - Shows inline actions like references count, tests, etc.
// ============================================================================

/** Global code lens settings state - updated from SettingsContext */
let codeLensSettings = {
  enabled: true,
  fontFamily: '',
  fontSize: 12,
  showReferences: true,
  showImplementations: true,
  showTestActions: true,
};

/** Test function patterns for common testing frameworks */
const TEST_PATTERNS = {
  jest: /^(?:export\s+)?(?:async\s+)?(?:function\s+)?(?:it|test|describe)\s*\(/,
  vitest: /^(?:export\s+)?(?:async\s+)?(?:function\s+)?(?:it|test|describe|suite)\s*\(/,
  rust: /^#\[test\]|^#\[tokio::test\]/,
  pytest: /^(?:async\s+)?def\s+test_/,
  go: /^func\s+Test[A-Z]/,
};

/** Check if a code lens command is for references */
function isReferenceLens(command?: { title: string; command?: string }): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return title.includes('reference') || title.includes('usage');
}

/** Check if a code lens command is for implementations */
function isImplementationLens(command?: { title: string; command?: string }): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return title.includes('implementation');
}

/** Check if a code lens command is for test actions */
function isTestLens(command?: { title: string; command?: string }): boolean {
  if (!command) return false;
  const title = command.title.toLowerCase();
  return title.includes('run') || title.includes('debug') || title.includes('test');
}

/** Check if a line is a test function definition */
function isTestLine(lineText: string, language: string): boolean {
  const trimmed = lineText.trim();
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'typescriptreact':
    case 'javascriptreact':
      return TEST_PATTERNS.jest.test(trimmed) || TEST_PATTERNS.vitest.test(trimmed);
    case 'rust':
      return TEST_PATTERNS.rust.test(trimmed);
    case 'python':
      return TEST_PATTERNS.pytest.test(trimmed);
    case 'go':
      return TEST_PATTERNS.go.test(trimmed);
    default:
      return false;
  }
}

/** Extract test name from a line */
function extractTestName(lineText: string, language: string): string | null {
  const trimmed = lineText.trim();
  switch (language) {
    case 'typescript':
    case 'javascript':
    case 'typescriptreact':
    case 'javascriptreact': {
      const match = trimmed.match(/(?:it|test|describe|suite)\s*\(\s*['"`]([^'"`]+)['"`]/);
      return match ? match[1] : null;
    }
    case 'rust': {
      const match = trimmed.match(/(?:async\s+)?fn\s+(\w+)/);
      return match ? match[1] : null;
    }
    case 'python': {
      const match = trimmed.match(/(?:async\s+)?def\s+(test_\w+)/);
      return match ? match[1] : null;
    }
    case 'go': {
      const match = trimmed.match(/func\s+(Test\w+)/);
      return match ? match[1] : null;
    }
    default:
      return null;
  }
}

/**
 * Update code lens settings from SettingsContext.
 * Called when editor settings change.
 */
function updateCodeLensSettings(settings: typeof codeLensSettings): void {
  codeLensSettings = { ...settings };
}

/**
 * Register CodeLens provider for all supported languages.
 * Integrates with LSP to fetch code lenses for actions like "Run Test",
 * "X references", "Implement interface", etc.
 */
function registerCodeLensProvider(monaco: typeof Monaco): void {
  // Dispose previous providers
  codeLensProviderDisposables.forEach((d) => d?.dispose?.());
  codeLensProviderDisposables = [];

  // Languages that commonly support code lens via LSP
  const supportedLanguages = [
    'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
    'rust', 'go', 'python', 'java', 'kotlin', 'c', 'cpp', 'csharp'
  ];

  for (const language of supportedLanguages) {
    const disposable = monaco.languages.registerCodeLensProvider(language, {
      provideCodeLenses: async (
        model: Monaco.editor.ITextModel,
        _token: Monaco.CancellationToken
      ): Promise<Monaco.languages.CodeLensList> => {
        // Check if code lens is enabled
        if (!codeLensSettings.enabled) {
          return { lenses: [], dispose: () => {} };
        }

        const uri = model.uri.toString();
        const filePath = uri.replace('file://', '');
        const allLenses: Monaco.languages.CodeLens[] = [];

        try {
          // Request code lenses from LSP backend using multi-provider
          const response = await invoke<LSPCodeLensResult>('lsp_multi_code_lens', {
            language,
            params: {
              uri: filePath,
            },
          });

          if (response && response.lenses && response.lenses.length > 0) {
            // Convert LSP code lenses to Monaco format, filtering by settings
            for (const lens of response.lenses) {
              // Apply settings-based filtering
              if (isReferenceLens(lens.command) && !codeLensSettings.showReferences) continue;
              if (isImplementationLens(lens.command) && !codeLensSettings.showImplementations) continue;
              if (isTestLens(lens.command) && !codeLensSettings.showTestActions) continue;

              allLenses.push({
                range: new monaco.Range(
                  lens.range.start.line + 1,
                  lens.range.start.character + 1,
                  lens.range.end.line + 1,
                  lens.range.end.character + 1
                ),
                command: lens.command ? {
                  id: lens.command.command,
                  title: lens.command.title,
                  arguments: lens.command.arguments,
                } : undefined,
              });
            }
          }
        } catch (error) {
          // LSP not available or error - continue with test detection
          console.debug('Code lens not available:', error);
        }

        // Generate test action code lenses if enabled
        if (codeLensSettings.showTestActions) {
          const lineCount = model.getLineCount();
          for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
            const lineText = model.getLineContent(lineNumber);
            if (isTestLine(lineText, language)) {
              const testName = extractTestName(lineText, language);
              if (testName) {
                // Run test lens
                allLenses.push({
                  range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                  command: {
                    id: 'orion.runTest',
                    title: 'Run Test',
                    arguments: [filePath, testName, lineNumber],
                  },
                });

                // Debug test lens
                allLenses.push({
                  range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                  command: {
                    id: 'orion.debugTest',
                    title: 'Debug',
                    arguments: [filePath, testName, lineNumber],
                  },
                });
              }
            }
          }
        }

        return {
          lenses: allLenses,
          dispose: () => {},
        };
      },

      resolveCodeLens: async (
        _model: Monaco.editor.ITextModel,
        codeLens: Monaco.languages.CodeLens,
        _token: Monaco.CancellationToken
      ): Promise<Monaco.languages.CodeLens> => {
        // CodeLens resolution is typically handled by the LSP server
        // For now, return as-is since most LSPs return fully resolved lenses
        return codeLens;
      },
    });

    codeLensProviderDisposables.push(disposable);
  }

  // Register test action commands
  const runTestCommand = monaco.editor.registerCommand('orion.runTest', async (_accessor, filePath, testName, lineNumber) => {
    try {
      await invoke('testing_run_single_test', {
        filePath,
        testName,
        lineNumber,
        debug: false,
      });
    } catch (e) {
      console.error('Failed to run test:', e);
    }
  });
  codeLensProviderDisposables.push(runTestCommand);

  const debugTestCommand = monaco.editor.registerCommand('orion.debugTest', async (_accessor, filePath, testName, lineNumber) => {
    try {
      await invoke('testing_run_single_test', {
        filePath,
        testName,
        lineNumber,
        debug: true,
      });
    } catch (e) {
      console.error('Failed to debug test:', e);
    }
  });
  codeLensProviderDisposables.push(debugTestCommand);
}

// ============================================================================
// Semantic Tokens Provider - Advanced syntax highlighting from LSP
// ============================================================================

/**
 * Standard semantic token types as defined by LSP specification.
 * These provide more accurate highlighting than regex-based tokenization.
 */
const SEMANTIC_TOKEN_TYPES = [
  'namespace', 'type', 'class', 'enum', 'interface', 'struct',
  'typeParameter', 'parameter', 'variable', 'property', 'enumMember',
  'event', 'function', 'method', 'macro', 'keyword', 'modifier',
  'comment', 'string', 'number', 'regexp', 'operator', 'decorator'
];

/**
 * Standard semantic token modifiers as defined by LSP specification.
 * These provide additional styling information (e.g., "static", "readonly").
 */
const SEMANTIC_TOKEN_MODIFIERS = [
  'declaration', 'definition', 'readonly', 'static', 'deprecated',
  'abstract', 'async', 'modification', 'documentation', 'defaultLibrary'
];

/**
 * Register Semantic Tokens provider for all supported languages.
 * Integrates with LSP to fetch semantic tokens for enhanced syntax highlighting.
 * Provides more accurate highlighting than pure TextMate grammar-based tokenization.
 */
function registerSemanticTokensProvider(monaco: typeof Monaco): void {
  // Dispose previous providers
  semanticTokensProviderDisposables.forEach((d) => d?.dispose?.());
  semanticTokensProviderDisposables = [];

  // Create the legend for semantic tokens
  const legend: Monaco.languages.SemanticTokensLegend = {
    tokenTypes: SEMANTIC_TOKEN_TYPES,
    tokenModifiers: SEMANTIC_TOKEN_MODIFIERS,
  };

  // Languages that commonly support semantic tokens via LSP
  const supportedLanguages = [
    'typescript', 'javascript', 'typescriptreact', 'javascriptreact',
    'rust', 'go', 'python', 'java', 'kotlin', 'c', 'cpp', 'csharp'
  ];

  for (const language of supportedLanguages) {
    const disposable = monaco.languages.registerDocumentSemanticTokensProvider(language, {
      getLegend: () => legend,

      provideDocumentSemanticTokens: async (
        model: Monaco.editor.ITextModel,
        _lastResultId: string | null,
        _token: Monaco.CancellationToken
      ): Promise<Monaco.languages.SemanticTokens | null> => {
        const uri = model.uri.toString();
        const filePath = uri.replace('file://', '');

        try {
          // Request semantic tokens from LSP backend using multi-provider
          const response = await invoke<LSPSemanticTokensResult>('lsp_multi_semantic_tokens', {
            language,
            params: {
              uri: filePath,
            },
          });

          if (!response || !response.data || response.data.length === 0) {
            return null;
          }

          return {
            data: new Uint32Array(response.data),
            resultId: response.resultId,
          };
        } catch (error) {
          // LSP not available or error - return null to let Monaco use default tokenization
          console.debug('Semantic tokens not available:', error);
          return null;
        }
      },

      releaseDocumentSemanticTokens: (_resultId: string | undefined) => {
        // Nothing to release for our implementation
      },
    });

    semanticTokensProviderDisposables.push(disposable);
  }
}

// ============================================================================
// Debug Hover Provider - Rich variable inspection during debugging
// ============================================================================

/** SVG icons for debug hover buttons (inline for Monaco HTML support) */
const DEBUG_HOVER_ICONS = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
  watch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>',
};

/** Interface for evaluated debug variable information */
interface DebugEvaluateResult {
  result: string;
  type?: string;
  variablesReference: number;
}

/** Interface for expanded variable children */
interface DebugVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
}

/** Cached debug state for hover provider */
interface DebugHoverState {
  isPaused: boolean;
  activeSessionId: string | null;
  evaluate: (expression: string, context?: string) => Promise<DebugEvaluateResult>;
  expandVariable: (variablesReference: number) => Promise<DebugVariable[]>;
  addWatchExpression: (expression: string) => void;
}

/** Global debug hover state - updated from component context */
let debugHoverState: DebugHoverState | null = null;

/** Track registered debug hover provider disposable for cleanup */
let debugHoverProviderDisposable: Monaco.IDisposable | null = null;

/**
 * Updates the debug hover state from the debug context.
 * Called when debug state changes (pause/resume/stop).
 */
function updateDebugHoverState(state: DebugHoverState | null): void {
  debugHoverState = state;
}

/**
 * Determines the value type class for syntax highlighting in hover.
 */
function getDebugValueTypeClass(type: string | undefined, value: string): string {
  const typeLower = type?.toLowerCase() || '';
  
  if (typeLower.includes('string') || value.startsWith('"') || value.startsWith("'")) {
    return 'string';
  }
  if (typeLower.includes('number') || typeLower.includes('int') || typeLower.includes('float') || /^-?\d+\.?\d*$/.test(value)) {
    return 'number';
  }
  if (value === 'true' || value === 'false' || typeLower.includes('bool')) {
    return 'boolean';
  }
  if (value === 'null' || value === 'undefined' || value === 'None' || value === 'nil') {
    return 'null';
  }
  if (typeLower.includes('function') || typeLower.includes('method') || value.startsWith('function') || value.startsWith('ƒ')) {
    return 'function';
  }
  return 'object';
}

/**
 * Escapes HTML special characters for safe rendering.
 */
function escapeDebugHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Copies text to clipboard and shows a toast notification.
 */
async function copyDebugValueToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showDebugHoverToast('Value copied to clipboard');
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
}

/**
 * Shows a brief toast notification for debug hover actions.
 */
function showDebugHoverToast(message: string): void {
  const existingToast = document.querySelector('.debug-hover-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'debug-hover-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 2000);
}

/**
 * Creates an expandable tree node HTML for a variable in the hover tooltip.
 */
function createDebugTreeNodeHtml(
  name: string,
  value: string,
  type: string | undefined,
  variablesReference: number,
  depth: number
): string {
  const hasChildren = variablesReference > 0;
  const valueClass = getDebugValueTypeClass(type, value);
  const indentStyle = `padding-left: ${10 + depth * 16}px`;
  const nodeId = `debug-hover-node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  let html = `<li class="debug-hover-tree-item" data-node-id="${nodeId}" data-var-ref="${variablesReference}" data-depth="${depth}">`;
  html += `<div class="debug-hover-tree-row" style="${indentStyle}">`;
  
  if (hasChildren) {
    html += `<div class="debug-hover-tree-toggle" data-action="toggle">${DEBUG_HOVER_ICONS.chevronRight}</div>`;
  } else {
    html += `<div class="debug-hover-tree-indent"></div>`;
  }
  
  html += `<span class="debug-hover-tree-key">${escapeDebugHtml(name)}</span>`;
  html += `<span class="debug-hover-tree-separator">:</span>`;
  
  if (type) {
    html += `<span class="debug-hover-tree-type">${escapeDebugHtml(type)}</span>`;
  }
  
  html += `<span class="debug-hover-tree-value ${valueClass}" title="${escapeDebugHtml(value)}">${escapeDebugHtml(value)}</span>`;
  html += `</div>`;
  html += `<ul class="debug-hover-tree-children" style="display: none;"></ul>`;
  html += `</li>`;
  
  return html;
}

/**
 * Builds the complete debug hover HTML content with header, actions, and value/tree.
 */
function buildDebugHoverHtml(
  expression: string,
  value: string,
  type: string | undefined,
  variablesReference: number
): string {
  const valueClass = getDebugValueTypeClass(type, value);
  const hasChildren = variablesReference > 0;
  
  let html = `<div class="debug-hover-container" data-expression="${escapeDebugHtml(expression)}" data-value="${escapeDebugHtml(value)}" data-var-ref="${variablesReference}">`;
  
  // Header with name, type, and action buttons
  html += `<div class="debug-hover-header">`;
  html += `<div class="debug-hover-name-section">`;
  html += `<span class="debug-hover-name">${escapeDebugHtml(expression)}</span>`;
  if (type) {
    html += `<span class="debug-hover-type">${escapeDebugHtml(type)}</span>`;
  }
  html += `</div>`;
  
  // Action buttons - Copy and Add to Watch
  html += `<div class="debug-hover-actions">`;
  html += `<button class="debug-hover-btn" data-action="copy" title="Copy value">${DEBUG_HOVER_ICONS.copy}</button>`;
  html += `<button class="debug-hover-btn" data-action="watch" title="Add to watch">${DEBUG_HOVER_ICONS.watch}</button>`;
  html += `</div>`;
  html += `</div>`;
  
  // Content area with value display or expandable tree
  html += `<div class="debug-hover-content">`;
  
  if (hasChildren) {
    // Tree view for objects/arrays that can be expanded
    html += `<ul class="debug-hover-tree">`;
    html += createDebugTreeNodeHtml(expression, value, type, variablesReference, 0);
    html += `</ul>`;
  } else {
    // Simple value display for primitives
    html += `<div class="debug-hover-value ${valueClass}">${escapeDebugHtml(value)}</div>`;
  }
  
  html += `</div>`;
  html += `</div>`;
  
  return html;
}

/**
 * Handles click events within the debug hover tooltip for actions.
 */
async function handleDebugHoverClick(event: MouseEvent): Promise<void> {
  const target = event.target as HTMLElement;
  
  // Find action button or toggle element
  const actionButton = target.closest('[data-action]') as HTMLElement;
  if (!actionButton) return;
  
  const action = actionButton.getAttribute('data-action');
  const container = target.closest('.debug-hover-container') as HTMLElement;
  
  if (!container) return;
  
  switch (action) {
    case 'copy': {
      const value = container.getAttribute('data-value') || '';
      await copyDebugValueToClipboard(value);
      break;
    }
    
    case 'watch': {
      const expression = container.getAttribute('data-expression') || '';
      if (debugHoverState && expression) {
        debugHoverState.addWatchExpression(expression);
        showDebugHoverToast(`Added "${expression}" to watch`);
      }
      break;
    }
    
    case 'toggle': {
      await handleDebugTreeToggle(actionButton);
      break;
    }
  }
}

/**
 * Handles expanding/collapsing tree nodes in the debug hover.
 */
async function handleDebugTreeToggle(toggleButton: HTMLElement): Promise<void> {
  const treeItem = toggleButton.closest('.debug-hover-tree-item') as HTMLElement;
  if (!treeItem) return;
  
  const childrenContainer = treeItem.querySelector('.debug-hover-tree-children') as HTMLElement;
  if (!childrenContainer) return;
  
  const isExpanded = toggleButton.classList.contains('expanded');
  
  if (isExpanded) {
    // Collapse the node
    toggleButton.classList.remove('expanded');
    childrenContainer.style.display = 'none';
  } else {
    // Expand the node
    toggleButton.classList.add('expanded');
    childrenContainer.style.display = 'block';
    
    // Load children if not already loaded
    if (childrenContainer.children.length === 0 && debugHoverState) {
      const varRef = parseInt(treeItem.getAttribute('data-var-ref') || '0', 10);
      const depth = parseInt(treeItem.getAttribute('data-depth') || '0', 10);
      
      if (varRef > 0) {
        // Show loading indicator
        childrenContainer.innerHTML = `<li class="debug-hover-loading"><div class="debug-hover-loading-spinner"></div>Loading...</li>`;
        
        try {
          const children = await debugHoverState.expandVariable(varRef);
          
          if (children.length === 0) {
            childrenContainer.innerHTML = `<li class="debug-hover-empty">No properties</li>`;
          } else {
            childrenContainer.innerHTML = children.map(child =>
              createDebugTreeNodeHtml(child.name, child.value, child.type, child.variablesReference, depth + 1)
            ).join('');
          }
        } catch (err) {
          childrenContainer.innerHTML = `<li class="debug-hover-error">Failed to load properties</li>`;
          console.error('Failed to expand variable:', err);
        }
      }
    }
  }
}

/**
 * Extracts the full expression at a position, handling property access chains.
 * e.g., "user.profile.name" or "arr[0].value"
 */
function extractDebugExpression(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  wordInfo: Monaco.editor.IWordAtPosition
): string {
  const word = wordInfo.word;
  const lineContent = model.getLineContent(position.lineNumber);
  
  // Look backwards for property access chain (e.g., obj.prop, arr[0])
  let startCol = wordInfo.startColumn - 1;
  let potentialExpr = word;
  
  while (startCol > 0) {
    const charBefore = lineContent[startCol - 1];
    
    if (charBefore === '.') {
      // Find identifier before the dot
      let identEnd = startCol - 1;
      let identStart = identEnd;
      
      while (identStart > 0 && /[\w$]/.test(lineContent[identStart - 1])) {
        identStart--;
      }
      
      if (identStart < identEnd) {
        const prevIdent = lineContent.substring(identStart, identEnd);
        potentialExpr = prevIdent + '.' + potentialExpr;
        startCol = identStart;
        continue;
      }
    } else if (charBefore === ']') {
      // Handle array access like arr[0] or obj["key"]
      let bracketDepth = 1;
      let bracketStart = startCol - 2;
      
      while (bracketStart >= 0 && bracketDepth > 0) {
        if (lineContent[bracketStart] === '[') bracketDepth--;
        else if (lineContent[bracketStart] === ']') bracketDepth++;
        bracketStart--;
      }
      
      if (bracketDepth === 0 && bracketStart >= 0) {
        // Find identifier before the bracket
        let identEnd = bracketStart + 1;
        let identStart = identEnd;
        
        while (identStart > 0 && /[\w$]/.test(lineContent[identStart - 1])) {
          identStart--;
        }
        
        if (identStart < identEnd) {
          const prevIdent = lineContent.substring(identStart, identEnd);
          const bracketContent = lineContent.substring(bracketStart + 2, startCol - 1);
          potentialExpr = prevIdent + '[' + bracketContent + ']' + (potentialExpr !== word ? '.' + potentialExpr : '');
          startCol = identStart;
          continue;
        }
      }
    }
    
    break;
  }
  
  return potentialExpr.length > word.length ? potentialExpr : word;
}

/**
 * Registers the debug hover provider for all languages.
 * Shows rich variable information when hovering during debug sessions.
 */
function registerDebugHoverProvider(monaco: typeof Monaco): void {
  // Dispose previous provider if exists
  if (debugHoverProviderDisposable) {
    debugHoverProviderDisposable?.dispose?.();
    debugHoverProviderDisposable = null;
  }
  
  // Register hover provider for all languages
  debugHoverProviderDisposable = monaco.languages.registerHoverProvider('*', {
    provideHover: async (
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _token: Monaco.CancellationToken
    ): Promise<Monaco.languages.Hover | null> => {
      // Only provide hover when debugging is paused
      if (!debugHoverState || !debugHoverState.isPaused || !debugHoverState.activeSessionId) {
        return null;
      }
      
      // Get the word at the hover position
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo || wordInfo.word.length < 1) {
        return null;
      }
      
      // Extract the full expression (handles property chains)
      const expression = extractDebugExpression(model, position, wordInfo);
      
      try {
        // Evaluate the expression using the debug adapter
        const result = await debugHoverState.evaluate(expression, 'hover');
        
        // Build the rich hover content HTML
        const hoverHtml = buildDebugHoverHtml(
          expression,
          result.result,
          result.type,
          result.variablesReference
        );
        
        return {
          range: new monaco.Range(
            position.lineNumber,
            wordInfo.startColumn,
            position.lineNumber,
            wordInfo.endColumn
          ),
          contents: [
            {
              value: hoverHtml,
              supportHtml: true,
              isTrusted: true,
            } as Monaco.IMarkdownString,
          ],
        };
      } catch {
        // Expression couldn't be evaluated - return null to let other providers handle it
        return null;
      }
    },
  });
  
  // Add global click handler for hover action buttons
  document.addEventListener('click', handleDebugHoverClick);
}

/**
 * Disposes the debug hover provider and removes event listeners.
 */
function disposeDebugHoverProvider(): void {
  if (debugHoverProviderDisposable) {
    debugHoverProviderDisposable?.dispose?.();
    debugHoverProviderDisposable = null;
  }
  document.removeEventListener('click', handleDebugHoverClick);
}

// ============================================================================
// Linked Editing for HTML/JSX/XML Tags
// ============================================================================

/**
 * Parse HTML/JSX/XML content to find tag pairs and their positions.
 * Returns the matching tag range if the cursor is inside a tag name.
 */
function findLinkedEditingRanges(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  monaco: typeof Monaco
): Monaco.languages.LinkedEditingRanges | null {
  if (!linkedEditingEnabled) return null;

  const lineContent = model.getLineContent(position.lineNumber);
  const column = position.column;
  
  // Check if we're inside a tag name
  const tagInfo = getTagAtPosition(lineContent, column);
  if (!tagInfo) return null;

  const { tagName, isClosingTag, startColumn, endColumn } = tagInfo;
  
  // Self-closing tags don't have linked editing
  if (tagInfo.isSelfClosing) return null;

  const content = model.getValue();
  
  // Find the matching tag
  const matchingRange = findMatchingTag(
    content,
    model,
    position.lineNumber,
    startColumn,
    endColumn,
    tagName,
    isClosingTag,
    monaco
  );

  if (!matchingRange) return null;

  // Create the current tag range
  const currentRange = new monaco.Range(
    position.lineNumber,
    startColumn,
    position.lineNumber,
    endColumn
  );

  return {
    ranges: [currentRange, matchingRange],
    wordPattern: /[a-zA-Z][a-zA-Z0-9-]*/,
  };
}

/**
 * Extract tag information at a given cursor position in a line.
 */
function getTagAtPosition(
  lineContent: string,
  column: number
): {
  tagName: string;
  isClosingTag: boolean;
  isSelfClosing: boolean;
  startColumn: number;
  endColumn: number;
} | null {
  // Find all tags in the line
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9.-]*)/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(lineContent)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1];
    const isClosingTag = fullMatch.startsWith("</");
    const tagNameStart = match.index + (isClosingTag ? 2 : 1) + 1; // +1 for 1-based column
    const tagNameEnd = tagNameStart + tagName.length;

    // Check if cursor is within the tag name
    if (column >= tagNameStart && column <= tagNameEnd) {
      // Check if this tag is self-closing by looking ahead
      const restOfLine = lineContent.substring(match.index);
      const selfClosingPattern = new RegExp(`<${tagName}[^>]*/>`);
      const isSelfClosing = !isClosingTag && selfClosingPattern.test(restOfLine);

      return {
        tagName,
        isClosingTag,
        isSelfClosing,
        startColumn: tagNameStart,
        endColumn: tagNameEnd,
      };
    }
  }

  return null;
}

/**
 * Find the matching opening/closing tag for a given tag.
 */
function findMatchingTag(
  content: string,
  _model: Monaco.editor.ITextModel,
  lineNumber: number,
  startColumn: number,
  endColumn: number,
  tagName: string,
  isClosingTag: boolean,
  monaco: typeof Monaco
): Monaco.Range | null {
  const lines = content.split("\n");
  
  if (isClosingTag) {
    // Find matching opening tag (search backwards)
    return findOpeningTag(lines, lineNumber - 1, startColumn - 1, tagName, monaco);
  } else {
    // Find matching closing tag (search forwards)
    return findClosingTag(lines, lineNumber - 1, endColumn - 1, tagName, monaco);
  }
}

/**
 * Search backwards for the matching opening tag.
 */
function findOpeningTag(
  lines: string[],
  fromLine: number,
  fromColumn: number,
  tagName: string,
  monaco: typeof Monaco
): Monaco.Range | null {
  let depth = 1;
  const closingTagPattern = new RegExp(`</${tagName}(?:\\s|>|$)`, "gi");
  const openingTagPattern = new RegExp(`<${tagName}(?:\\s|>|/|$)`, "gi");
  const selfClosingPattern = new RegExp(`<${tagName}[^>]*/\\s*>`, "gi");

  for (let line = fromLine; line >= 0; line--) {
    const lineContent = line === fromLine 
      ? lines[line].substring(0, fromColumn) 
      : lines[line];

    // Find all closing tags in this line (increase depth)
    closingTagPattern.lastIndex = 0;
    while (closingTagPattern.exec(lineContent) !== null) {
      depth++;
    }

    // Find all opening tags in this line
    let openMatch: RegExpExecArray | null;
    const openMatches: Array<{ index: number; length: number }> = [];
    openingTagPattern.lastIndex = 0;
    while ((openMatch = openingTagPattern.exec(lineContent)) !== null) {
      // Check if this is a self-closing tag
      const restOfLine = lines[line].substring(openMatch.index);
      selfClosingPattern.lastIndex = 0;
      const isSelfClosing = selfClosingPattern.test(restOfLine.split(">")[0] + ">");
      
      if (!isSelfClosing) {
        openMatches.push({ index: openMatch.index, length: tagName.length });
      }
    }

    // Process opening tags in reverse order (right to left)
    for (let i = openMatches.length - 1; i >= 0; i--) {
      depth--;
      if (depth === 0) {
        const startColumn = openMatches[i].index + 2; // +1 for '<', +1 for 1-based
        const endColumn = startColumn + tagName.length;
        return new monaco.Range(line + 1, startColumn, line + 1, endColumn);
      }
    }
  }

  return null;
}

/**
 * Search forwards for the matching closing tag.
 */
function findClosingTag(
  lines: string[],
  fromLine: number,
  fromColumn: number,
  tagName: string,
  monaco: typeof Monaco
): Monaco.Range | null {
  let depth = 1;
  const closingTagPattern = new RegExp(`</${tagName}(?:\\s|>|$)`, "gi");
  const openingTagPattern = new RegExp(`<${tagName}(?:\\s|>|/|$)`, "gi");
  const selfClosingPattern = new RegExp(`<${tagName}[^>]*/\\s*>`, "gi");

  for (let line = fromLine; line < lines.length; line++) {
    const lineContent = line === fromLine 
      ? lines[line].substring(fromColumn) 
      : lines[line];
    const columnOffset = line === fromLine ? fromColumn : 0;

    // Find all opening tags in this line (increase depth)
    let openMatch: RegExpExecArray | null;
    openingTagPattern.lastIndex = 0;
    while ((openMatch = openingTagPattern.exec(lineContent)) !== null) {
      // Check if this is a self-closing tag
      const restOfLine = lineContent.substring(openMatch.index);
      selfClosingPattern.lastIndex = 0;
      const isSelfClosing = selfClosingPattern.test(restOfLine.split(">")[0] + ">");
      
      if (!isSelfClosing) {
        depth++;
      }
    }

    // Find all closing tags in this line
    let closeMatch: RegExpExecArray | null;
    const closeMatches: Array<{ index: number; length: number }> = [];
    closingTagPattern.lastIndex = 0;
    while ((closeMatch = closingTagPattern.exec(lineContent)) !== null) {
      closeMatches.push({ index: closeMatch.index, length: tagName.length });
    }

    // Process closing tags in order (left to right)
    for (let i = 0; i < closeMatches.length; i++) {
      depth--;
      if (depth === 0) {
        const startColumn = columnOffset + closeMatches[i].index + 3; // +2 for '</', +1 for 1-based
        const endColumn = startColumn + tagName.length;
        return new monaco.Range(line + 1, startColumn, line + 1, endColumn);
      }
    }
  }

  return null;
}

/**
 * Register linked editing range providers for HTML, JSX, and XML languages.
 * Enables synchronized editing of opening and closing tags.
 */
function registerLinkedEditingProviders(monaco: typeof Monaco): void {
  // Dispose previous providers
  linkedEditingProviderDisposables.forEach((d) => d?.dispose?.());
  linkedEditingProviderDisposables = [];

  // Languages that support HTML-like tags
  const supportedLanguages = [
    "html",
    "xml",
    "xhtml",
    "javascriptreact",
    "typescriptreact",
    "vue",
    "svelte",
    "php",
    "handlebars",
    "razor",
  ];

  for (const language of supportedLanguages) {
    const disposable = monaco.languages.registerLinkedEditingRangeProvider(language, {
      provideLinkedEditingRanges: (
        model: Monaco.editor.ITextModel,
        position: Monaco.Position,
        _token: Monaco.CancellationToken
      ): Monaco.languages.ProviderResult<Monaco.languages.LinkedEditingRanges> => {
        return findLinkedEditingRanges(model, position, monaco);
      },
    });

    linkedEditingProviderDisposables.push(disposable);
  }
}

/**
 * Update linked editing enabled state.
 */
function updateLinkedEditingEnabled(enabled: boolean): void {
  linkedEditingEnabled = enabled;
}

// ============================================================================
// Format on Paste
// ============================================================================

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

/**
 * Setup format-on-paste functionality for the editor.
 * Listens for paste events and formats only the pasted content range,
 * respecting the indentation of the paste location.
 */
function setupFormatOnPaste(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco
): Monaco.IDisposable {
  // Flag to track when a paste operation is in progress
  let isPasteOperation = false;
  
  // Store the position where paste started (reserved for future cursor restoration)
  // @ts-expect-error Reserved for future cursor restoration feature
  let _pasteStartPosition: Monaco.Position | null = null;
  
  // Get the editor's DOM node for paste event listening
  const domNode = editor.getDomNode();
  
  /**
   * Handle paste event from DOM - mark that paste is happening
   * and capture the starting position before content changes
   */
  const handlePaste = (_e: ClipboardEvent) => {
    if (!formatOnPasteEnabled) return;
    
    // Mark that a paste operation is starting
    isPasteOperation = true;
    
    // Store the current cursor position as paste start
    _pasteStartPosition = editor.getPosition();
  };
  
  // Add paste event listener to editor's DOM node
  if (domNode) {
    domNode.addEventListener('paste', handlePaste, true);
  }
  
  /**
   * Handle content changes - detect completed paste and format the range
   */
  const contentChangeDisposable = editor.onDidChangeModelContent(async (e) => {
    // Only process if this was triggered by a paste operation
    if (!isPasteOperation) return;
    
    // Reset the paste flag immediately
    isPasteOperation = false;
    
    // Check if format-on-paste is still enabled
    if (!formatOnPasteEnabled) {
      _pasteStartPosition = null;
      return;
    }
    
    // Must have changes to process
    if (e.changes.length === 0) {
      _pasteStartPosition = null;
      return;
    }
    
    const model = editor.getModel();
    if (!model) {
      _pasteStartPosition = null;
      return;
    }
    
    // Calculate the range that was affected by the paste
    // The changes array contains all the edits made during paste
    let minStartLine = Infinity;
    let maxEndLine = -Infinity;
    
    for (const change of e.changes) {
      // change.range is the range that was replaced (before paste)
      // change.text is the text that was inserted
      const lines = change.text.split('\n');
      const startLine = change.range.startLineNumber;
      const endLine = startLine + lines.length - 1;
      
      minStartLine = Math.min(minStartLine, startLine);
      maxEndLine = Math.max(maxEndLine, endLine);
    }
    
    // Validate the calculated range
    if (minStartLine > maxEndLine || minStartLine > model.getLineCount()) {
      _pasteStartPosition = null;
      return;
    }
    
    // Clamp to valid line numbers
    maxEndLine = Math.min(maxEndLine, model.getLineCount());
    
    // Create the range to format - full lines for better formatting
    const rangeToFormat = new monaco.Range(
      minStartLine,
      1,
      maxEndLine,
      model.getLineMaxColumn(maxEndLine)
    );
    
    // Store cursor position for restoration after format
    const cursorAfterPaste = editor.getPosition();
    
    // Use requestAnimationFrame to ensure editor state is stable
    requestAnimationFrame(async () => {
      try {
        // Set selection to the pasted range for formatting
        editor.setSelection(rangeToFormat);
        
        // Trigger format selection action - this uses LSP formatting if available
        const formatAction = editor.getAction('editor.action.formatSelection');
        if (formatAction) {
          await formatAction.run();
        }
        
        // Restore cursor to end of pasted/formatted content
        // Try to place cursor at a sensible location after formatting
        if (cursorAfterPaste) {
          // Check if the cursor position is still valid after formatting
          const newModel = editor.getModel();
          if (newModel) {
            const maxLine = newModel.getLineCount();
            const targetLine = Math.min(cursorAfterPaste.lineNumber, maxLine);
            const maxColumn = newModel.getLineMaxColumn(targetLine);
            const targetColumn = Math.min(cursorAfterPaste.column, maxColumn);
            editor.setPosition({ lineNumber: targetLine, column: targetColumn });
          }
        }
      } catch (err) {
        // Formatting failed - not critical, just log for debugging
        console.debug('[FormatOnPaste] Formatting failed:', err);
      }
    });
    
    // Clear the stored start position
    _pasteStartPosition = null;
  });
  
  // Return disposable for cleanup
  return {
    dispose: () => {
      if (domNode) {
        domNode.removeEventListener('paste', handlePaste, true);
      }
      contentChangeDisposable?.dispose?.();
    }
  };
}

/**
 * Setup linked editing visual indicators and JSX self-closing conversion.
 * This function adds:
 * 1. Visual decorations showing linked tag ranges
 * 2. JSX self-closing tag conversion support (<div></div> -> <div /> and vice versa)
 */
function setupLinkedEditing(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco
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
      linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
      return;
    }
    
    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) {
      linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
      return;
    }
    
    const linkedRanges = findLinkedEditingRanges(model, position, monaco);
    if (!linkedRanges || linkedRanges.ranges.length < 2) {
      linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, []);
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
        inlineClassName: index === 0 ? "linked-editing-current" : "linked-editing-matched",
        // Show in overview ruler
        overviewRuler: {
          color: "var(--cortex-info)80",
          position: monaco.editor.OverviewRulerLane.Center,
        },
      },
    }));
    
    linkedEditDecorations = editor.deltaDecorations(linkedEditDecorations, newDecorations);
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
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE],
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
      window.dispatchEvent(new CustomEvent("editor-linked-editing-changed", {
        detail: { enabled: newEnabled }
      }));
    },
  });
  
  /**
   * Add JSX self-closing tag conversion action.
   * Converts <tag></tag> to <tag /> and vice versa.
   */
  editor.addAction({
    id: "convert-jsx-tag",
    label: "Convert JSX Tag (Self-closing ↔ Paired)",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Slash],
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
            fullMatchEnd
          );
          
          ed.executeEdits("convert-jsx-tag", [{
            range: editRange,
            text: newText,
          }]);
          
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
          monaco
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
              matchingRange.endColumn + 1 // Include the '>'
            );
            
            // Check if there's content between tags
            const contentBetween = model.getValueInRange(new monaco.Range(
              position.lineNumber,
              openingEnd,
              matchingRange.startLineNumber,
              matchingRange.startColumn - 2 // Before '</'
            )).trim();
            
            // Only convert if empty (no content between tags)
            if (contentBetween === "") {
              const newText = `<${tagName}${attributes} />`;
              
              ed.executeEdits("convert-jsx-tag", [{
                range: fullRange,
                text: newText,
              }]);
              
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

const languageMap: Record<string, string> = {
  typescript: "typescript",
  javascript: "javascript",
  rust: "rust",
  python: "python",
  go: "go",
  json: "json",
  html: "html",
  css: "css",
  yaml: "yaml",
  toml: "ini",
  markdown: "markdown",
  sql: "sql",
  shell: "shell",
  dockerfile: "dockerfile",
  plaintext: "plaintext",
};

interface CodeEditorProps {
  file?: OpenFile;
  groupId?: string;
}

export function CodeEditor(props: CodeEditorProps) {
  const { state, updateFileContent, saveFile, updateCursorInfo } = useEditor();
  const vim = useVim();
  const { state: settingsState, updateEditorSetting, getEffectiveEditorSettings } = useSettings();
  const testing = useTesting();
  const debug = useDebug();
  let containerRef: HTMLDivElement | undefined;
  let editorInstance: Monaco.editor.IStandaloneCodeEditor | null = null;
  let isDisposed = false; // Track if component is being disposed
  const [isLoading, setIsLoading] = createSignal(true);
  const [currentEditor, setCurrentEditor] = createSignal<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [currentMonaco, setCurrentMonaco] = createSignal<typeof Monaco | null>(null);
  const [agentActive, setAgentActive] = createSignal(false); // Orange border when agent is reading/editing
  const [isDraggingOver, setIsDraggingOver] = createSignal(false); // Drop indicator when dragging over editor
  const [findReplaceOpen, setFindReplaceOpen] = createSignal(false); // Find/Replace widget visibility
  const [findReplaceShowReplace, setFindReplaceShowReplace] = createSignal(false); // Show replace section

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
    return file ? (languageMap[file.language] || file.language || "plaintext") : "plaintext";
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
    return langSettings.fontFamily ?? "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace";
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
    isRetrigger?: boolean
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
          trigger_kind: triggerCharacter ? 2 : (isRetrigger ? 3 : 1), // 1=Invoked, 2=TriggerCharacter, 3=ContentChange
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
    getSignatureHelpFromLSP
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
            registerInlayHintsProvider(monaco);
            registerLinkedEditingProviders(monaco);
            registerOnTypeFormattingProvider(monaco);
            registerCodeLensProvider(monaco);
            registerSemanticTokensProvider(monaco);
            registerDebugHoverProvider(monaco);
            registerUnicodeHoverProvider(monaco);
            registerUnicodeCodeActionProvider(monaco);
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
      monacoManager.ensureLoaded().then((monaco) => {
        monacoInstance = monaco;
        setCurrentMonaco(monaco);
        setIsLoading(false);
      }).catch((err) => {
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
      console.debug(`[CodeEditor] Effect triggered for file change: ${file?.name || 'null'}`);
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

      const monacoLanguage = languageMap[file.language] || "plaintext";
      
      // Calculate line count for large file optimizations (use fast estimation for large files)
      const lineCount = estimateLineCount(file.content);
      
      // Determine initial cursor style based on vim mode
      const initialCursorStyle = vim.enabled() && vim.mode() === "normal" ? "block" : "line";
      
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
        showFoldingControls: langEditorSettings.showFoldingControls ?? "mouseover",
        // Minimap Heatmap - carte thermique (pas de texte illisible)
        minimap: {
          enabled: langEditorSettings.minimapEnabled ?? true,
          autohide: "mouseover",
          side: "right",
          showSlider: "mouseover",
          renderCharacters: false,  // IMPORTANT: Desactiver le texte
          maxColumn: 80,
          scale: 1,
          size: "proportional",
        },
        // Font settings - use language-specific settings
        fontSize: langEditorSettings.fontSize ?? 13,
        lineHeight: (langEditorSettings.lineHeight ?? 1.5) * (langEditorSettings.fontSize ?? 13),
        fontFamily: langEditorSettings.fontFamily ?? "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
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
        renderControlCharacters: settingsState.settings.editor.renderControlCharacters ?? false,
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
          enabled: 'on',
          fontSize: 12,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          padding: true,
        },
        // Code Lens - reference counts, test actions, implementations
        codeLens: settingsState.settings.editor.codeLens?.enabled ?? true,
        codeLensFontFamily: settingsState.settings.editor.codeLens?.fontFamily || undefined,
        codeLensFontSize: settingsState.settings.editor.codeLens?.fontSize || 12,
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
          ambiguousCharacters: settingsState.settings.editor.unicodeHighlight?.ambiguousCharacters ?? true,
          invisibleCharacters: settingsState.settings.editor.unicodeHighlight?.invisibleCharacters ?? true,
          nonBasicASCII: settingsState.settings.editor.unicodeHighlight?.nonBasicASCII ?? false,
          includeComments: settingsState.settings.editor.unicodeHighlight?.includeComments ?? "inUntrustedWorkspace",
          includeStrings: settingsState.settings.editor.unicodeHighlight?.includeStrings ?? true,
          allowedCharacters: (settingsState.settings.editor.unicodeHighlight?.allowedCharacters ?? {}) as Record<string, true>,
          allowedLocales: (settingsState.settings.editor.unicodeHighlight?.allowedLocales ?? { _os: true, _vscode: true }) as Record<string, true>,
        },
        // Large file optimizations - use settings
        largeFileOptimizations: settingsState.settings.editor.largeFileOptimizations ?? true,
        maxTokenizationLineLength: settingsState.settings.editor.maxTokenizationLineLength ?? 20000,
      };

      // Get large file settings from user configuration
      const largeFileSettings: LargeFileSettings = {
        largeFileOptimizations: settingsState.settings.editor.largeFileOptimizations ?? true,
        maxTokenizationLineLength: settingsState.settings.editor.maxTokenizationLineLength ?? 20000,
      };

      // Apply large file-specific optimizations
      const editorOptions = monacoManager.getOptionsForFile(baseOptions, lineCount, largeFileSettings);

      // Log large file optimizations if applied
      if (largeFileSettings.largeFileOptimizations && lineCount > LARGE_FILE_THRESHOLDS.DISABLE_MINIMAP) {
        console.debug(`[Monaco] Large file detected (${lineCount} lines), applying optimizations`);
      }

      // Track if this is a new editor creation (for one-time setup)
      const isNewEditor = !editorInitialized;
      
      // Check if we can reuse the existing editor instance (swap model instead of recreate)
      if (editorInstance && editorInitialized) {
        // Reuse existing editor - just swap the model
        const model = monacoManager.getOrCreateModel(file.path, file.content, monacoLanguage);
        editorInstance.setModel(model);
        console.debug(`[CodeEditor] Model swap: ${(performance.now() - modelStart).toFixed(1)}ms`);
        
        // Apply large file optimizations to existing editor (using settings)
        monacoManager.updateEditorForFileSize(
          editorInstance,
          lineCount,
          largeFileSettings,
          langEditorSettings.minimapEnabled ?? true,
          langEditorSettings.foldingEnabled ?? true,
          langEditorSettings.bracketPairColorization ?? true
        );
        
        // Update cursor style for vim mode
        editorInstance.updateOptions({ cursorStyle: initialCursorStyle });
        
        // Dispatch editor:file-ready event so other components know the editor is ready
        window.dispatchEvent(new CustomEvent("editor:file-ready", {
          detail: { filePath: file.path, fileId: file.id }
        }));
      } else {
        // Create new editor instance
        editorInstance = monacoInstance!.editor.create(containerRef, editorOptions);
        editorInitialized = true;

        // Set up the model using model caching
        const model = monacoManager.getOrCreateModel(file.path, file.content, monacoLanguage);
        editorInstance.setModel(model);
        console.debug(`[CodeEditor] Editor creation: ${(performance.now() - modelStart).toFixed(1)}ms`);
      }
      
      // Dispatch editor:file-ready event so other components know the editor is ready
      window.dispatchEvent(new CustomEvent("editor:file-ready", {
        detail: { filePath: file.path, fileId: file.id }
      }));
      
      // Update signal for VimMode component
      setCurrentEditor(editorInstance);

      // === ONE-TIME SETUP (only on new editor creation) ===
      if (isNewEditor) {
        // Critical setup - must be synchronous
        // Initialize format on type settings from context
        updateFormatOnTypeSettings({
          enabled: settingsState.settings.editor.formatOnType ?? false,
          triggerCharacters: settingsState.settings.editor.formatOnTypeTriggerCharacters ?? [";", "}", "\n"],
        });

        // Initialize unicode highlight settings from context
        const unicodeSettings = settingsState.settings.editor.unicodeHighlight;
        if (unicodeSettings) {
          updateUnicodeHighlightSettings({
            enabled: unicodeSettings.enabled ?? true,
            invisibleCharacters: unicodeSettings.invisibleCharacters ?? true,
            ambiguousCharacters: unicodeSettings.ambiguousCharacters ?? true,
            nonBasicASCII: unicodeSettings.nonBasicASCII ?? false,
            includeComments: unicodeSettings.includeComments ?? "inUntrustedWorkspace",
            includeStrings: unicodeSettings.includeStrings ?? true,
            allowedCharacters: unicodeSettings.allowedCharacters ?? {},
            allowedLocales: unicodeSettings.allowedLocales ?? { _os: true, _vscode: true },
          });
        }

        // Initialize linked editing state from settings
        updateLinkedEditingEnabled(settingsState.settings.editor.linkedEditing ?? true);
        
        // Setup linked editing visual indicators and JSX self-closing conversion
        setupLinkedEditing(editorInstance, monacoInstance);

        // Initialize format-on-paste state from settings
        updateFormatOnPasteEnabled(settingsState.settings.editor.formatOnPaste ?? false);
        
        // Setup format-on-paste functionality
        formatOnPasteDisposable = setupFormatOnPaste(editorInstance, monacoInstance);

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
        openIDECommandPalette
      );
      
      // Intercept F1 (critical)
      editor.addCommand(
        monaco.KeyCode.F1,
        openIDECommandPalette
      );
      
      // Override Monaco's internal quickCommand trigger (critical)
      const originalTrigger = editorInstance.trigger.bind(editorInstance);
      editorInstance.trigger = (source: string, handlerId: string, payload: any) => {
        if (handlerId === "editor.action.quickCommand") {
          openIDECommandPalette();
          return;
        }
        return originalTrigger(source, handlerId, payload);
      };
      
      // Override getAction to redirect quickCommand to our palette (critical)
      const originalGetAction = editorInstance.getAction.bind(editorInstance);
      editorInstance.getAction = (id: string): Monaco.editor.IEditorAction | null => {
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
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyCode.Slash],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.commentLine", null);
        },
      });
      
      // Add block comment toggle (Ctrl+Shift+/) - critical for daily use
      editorInstance.addAction({
        id: "toggle-block-comment",
        label: "Toggle Block Comment",
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyMod.Shift | monacoInstance!.KeyCode.Slash],
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
        keybindings: [monacoInstance!.KeyMod.Alt | monacoInstance!.KeyCode.KeyZ],
        run: (ed) => {
          if (!monacoInstance) return;
          const currentWrap = ed.getOption(monacoInstance!.editor.EditorOption.wordWrap);
          ed.updateOptions({ wordWrap: currentWrap === "off" ? "on" : "off" });
        },
      });
      
      // Add toggle minimap action
      editorInstance.addAction({
        id: "toggle-minimap",
        label: "Toggle Minimap",
        run: (ed) => {
          if (!monacoInstance) return;
          const currentOption = ed.getOption(monacoInstance!.editor.EditorOption.minimap);
          ed.updateOptions({ minimap: { enabled: !currentOption.enabled } });
        },
      });
      
      // Add toggle sticky scroll action (Ctrl+Shift+S)
      editorInstance.addAction({
        id: "toggle-sticky-scroll",
        label: "Toggle Sticky Scroll",
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyMod.Shift | monacoInstance!.KeyCode.KeyY],
        run: (ed) => {
          if (!monacoInstance) return;
          const currentOption = ed.getOption(monacoInstance!.editor.EditorOption.stickyScroll);
          const newEnabled = !currentOption.enabled;
          ed.updateOptions({ stickyScroll: { enabled: newEnabled, maxLineCount: 5 } });
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
          const currentOption = ed.getOption(monacoInstance!.editor.EditorOption.bracketPairColorization);
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
          const currentOption = ed.getOption(monacoInstance!.editor.EditorOption.guides);
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
          const currentOption = ed.getOption(monacoInstance!.editor.EditorOption.guides);
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
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyMod.Alt | monacoInstance!.KeyCode.KeyI],
        run: (ed) => {
          if (!monacoInstance) return;
          const currentOption = ed.getOption(monacoInstance!.editor.EditorOption.inlayHints);
          const currentEnabled = currentOption.enabled;
          // Toggle between 'on' and 'off'
          const newEnabled: 'on' | 'off' = currentEnabled === 'on' ? 'off' : 'on';
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
          const newValue = !inlayHintSettings.showParameterNames;
          updateInlayHintSettings({ showParameterNames: newValue });
        },
      });
      
      // Add toggle inlay hints type hints action
      editorInstance.addAction({
        id: "toggle-inlay-hints-type-hints",
        label: "Toggle Inlay Hints: Type Hints",
        run: () => {
          const newValue = !inlayHintSettings.showTypeHints;
          updateInlayHintSettings({ showTypeHints: newValue });
        },
      });
      
      // Add toggle unicode highlight action (Ctrl+Shift+U)
      editorInstance.addAction({
        id: "toggle-unicode-highlight",
        label: "Toggle Unicode Highlighting",
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyMod.Shift | monacoInstance!.KeyCode.KeyU],
        run: (ed) => {
          if (!monacoInstance) return;
          const newEnabled = !unicodeHighlightSettings.enabled;
          updateUnicodeHighlightSettings({ enabled: newEnabled });
          ed.updateOptions({
            unicodeHighlight: {
              ambiguousCharacters: newEnabled ? unicodeHighlightSettings.ambiguousCharacters : false,
              invisibleCharacters: newEnabled ? unicodeHighlightSettings.invisibleCharacters : false,
              nonBasicASCII: newEnabled ? unicodeHighlightSettings.nonBasicASCII : false,
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
          const newValue = !unicodeHighlightSettings.invisibleCharacters;
          updateUnicodeHighlightSettings({ invisibleCharacters: newValue });
          ed.updateOptions({
            unicodeHighlight: { invisibleCharacters: newValue },
          });
        },
      });
      
      // Add toggle unicode highlight ambiguous characters action
      editorInstance.addAction({
        id: "toggle-unicode-highlight-ambiguous",
        label: "Toggle Unicode Highlight: Ambiguous Characters (Homoglyphs)",
        run: (ed) => {
          if (!monacoInstance) return;
          const newValue = !unicodeHighlightSettings.ambiguousCharacters;
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
        keybindings: [monacoInstance!.KeyMod.Shift | monacoInstance!.KeyMod.Alt | monacoInstance!.KeyCode.KeyF],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.formatDocument", null);
        },
      });
      
      // Add toggle format-on-paste action (Ctrl+Shift+V)
      editorInstance.addAction({
        id: "toggle-format-on-paste",
        label: "Toggle Format on Paste",
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyMod.Shift | monacoInstance!.KeyCode.KeyV],
        run: () => {
          const newEnabled = !formatOnPasteEnabled;
          updateFormatOnPasteEnabled(newEnabled);
          // Persist the setting
          updateEditorSetting("formatOnPaste", newEnabled);
          // Emit event for settings sync
          window.dispatchEvent(new CustomEvent("editor-format-on-paste-changed", {
            detail: { enabled: newEnabled }
          }));
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
        id: 'editor.action.joinLines',
        label: 'Join Lines',
        keybindings: [
          monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyCode.KeyJ
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
            const endLine = selection.endLineNumber === startLine 
              ? startLine + 1 
              : selection.endLineNumber;
            
            // Join all lines in range
            for (let line = startLine; line < endLine && line < model.getLineCount(); line++) {
              const currentLineEnd = model.getLineMaxColumn(line);
              const nextLineStart = model.getLineFirstNonWhitespaceColumn(line + 1);
              
              // Remove newline and leading whitespace of next line, replace with single space
              edits.push({
                range: {
                  startLineNumber: line,
                  startColumn: currentLineEnd,
                  endLineNumber: line + 1,
                  endColumn: nextLineStart || 1
                },
                text: ' '
              });
            }
          }
          
          editor.executeEdits('joinLines', edits);
          editor.pushUndoStop();
        }
      });
      
      // Add toggle coverage decorations action (Ctrl+Shift+C)
      editorInstance.addAction({
        id: "toggle-coverage-decorations",
        label: "Toggle Test Coverage Decorations",
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyMod.Shift | monacoInstance!.KeyCode.KeyC],
        run: () => {
          testing.toggleCoverageDecorations();
        },
      });
      
      // Add toggle inline blame action (Ctrl+Alt+B)
      editorInstance.addAction({
        id: "toggle-inline-blame",
        label: "Toggle Inline Git Blame",
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyMod.Alt | monacoInstance!.KeyCode.KeyB],
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
        id: 'editor.foldAll',
        label: 'Fold All',
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyMod.Shift | monacoInstance!.KeyCode.BracketLeft],
        run: (editor) => editor.trigger('keyboard', 'editor.foldAll', null)
      });

      // Unfold All
      editorInstance.addAction({
        id: 'editor.unfoldAll',
        label: 'Unfold All',
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyMod.Shift | monacoInstance!.KeyCode.BracketRight],
        run: (editor) => editor.trigger('keyboard', 'editor.unfoldAll', null)
      });

      // Toggle Fold
      editorInstance.addAction({
        id: 'editor.toggleFold',
        label: 'Toggle Fold',
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyCode.BracketLeft],
        run: (editor) => editor.trigger('keyboard', 'editor.toggleFold', null)
      });

      // Fold Level 1-7
      for (let level = 1; level <= 7; level++) {
        editorInstance.addAction({
          id: `editor.foldLevel${level}`,
          label: `Fold Level ${level}`,
          keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyCode[`Digit${level}` as keyof typeof Monaco.KeyCode]],
          run: (editor) => editor.trigger('keyboard', `editor.foldLevel${level}`, null)
        });
      }

      // Fold All Block Comments
      editorInstance.addAction({
        id: 'editor.foldAllBlockComments',
        label: 'Fold All Block Comments',
        run: (editor) => editor.trigger('keyboard', 'editor.foldAllBlockComments', null)
      });

      // Fold All Regions
      editorInstance.addAction({
        id: 'editor.foldAllMarkerRegions',
        label: 'Fold All Regions',
        run: (editor) => editor.trigger('keyboard', 'editor.foldAllMarkerRegions', null)
      });

      // Unfold All Regions
      editorInstance.addAction({
        id: 'editor.unfoldAllMarkerRegions',
        label: 'Unfold All Regions',
        run: (editor) => editor.trigger('keyboard', 'editor.unfoldAllMarkerRegions', null)
      });

      // Fold Recursively
      editorInstance.addAction({
        id: 'editor.foldRecursively',
        label: 'Fold Recursively',
        run: (editor) => editor.trigger('keyboard', 'editor.foldRecursively', null)
      });

      // Unfold Recursively
      editorInstance.addAction({
        id: 'editor.unfoldRecursively',
        label: 'Unfold Recursively',
        run: (editor) => editor.trigger('keyboard', 'editor.unfoldRecursively', null)
      });

      // Add Peek Definition action (Alt+F12)
      editorInstance.addAction({
        id: "editor.action.peekDefinition",
        label: "Peek Definition",
        keybindings: [monacoInstance!.KeyMod.Alt | monacoInstance!.KeyCode.F12],
        run: (ed) => {
          ed.trigger("keyboard", "editor.action.peekDefinition", null);
        },
      });
      
      // Add Peek References action (Shift+F12) - uses LSP getReferences and shows inline peek
      editorInstance.addAction({
        id: "editor.action.referenceSearch.trigger",
        label: "Peek References",
        keybindings: [monacoInstance!.KeyMod.Shift | monacoInstance!.KeyCode.F12],
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
            const result = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_multi_references", {
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
              // Fallback: try the standard lsp_references
              const standardResult = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_references", {
                serverId: languageId,
                params: {
                  uri: filePath,
                  position: {
                    line: position.lineNumber - 1,
                    character: position.column - 1,
                  },
                },
              });

              if (!standardResult || !standardResult.locations || standardResult.locations.length === 0) {
                console.debug("No references found for peek");
                return;
              }

              // Convert to Location format for showPeekReferences
              const locations = standardResult.locations.map((loc) => ({
                uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`,
                range: {
                  start: { line: loc.range.start.line, character: loc.range.start.character },
                  end: { line: loc.range.end.line, character: loc.range.end.character },
                },
              }));

              showPeekReferences(locations, symbolName, position, uri);
              return;
            }

            // Convert to Location format for showPeekReferences
            const locations = result.locations.map((loc) => ({
              uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`,
              range: {
                start: { line: loc.range.start.line, character: loc.range.start.character },
                end: { line: loc.range.end.line, character: loc.range.end.character },
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
        keybindings: [monacoInstance!.KeyMod.Shift | monacoInstance!.KeyMod.Alt | monacoInstance!.KeyCode.F12],
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
            const result = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_multi_references", {
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
              // Fallback: try the standard lsp_references
              const standardResult = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_references", {
                serverId: languageId,
                params: {
                  uri: filePath,
                  position: {
                    line: position.lineNumber - 1,
                    character: position.column - 1,
                  },
                },
              });

              if (!standardResult || !standardResult.locations || standardResult.locations.length === 0) {
                console.debug("No references found");
                return;
              }

              // Convert to Location format for showReferencesPanel
              const locations = standardResult.locations.map((loc) => ({
                uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`,
                range: {
                  start: { line: loc.range.start.line, character: loc.range.start.character },
                  end: { line: loc.range.end.line, character: loc.range.end.character },
                },
              }));

              showReferencesPanel(
                locations,
                symbolName,
                uri,
                { line: position.lineNumber - 1, character: position.column - 1 }
              );
              return;
            }

            // Convert to Location format for showReferencesPanel
            const locations = result.locations.map((loc) => ({
              uri: loc.uri.startsWith("file://") ? loc.uri : `file://${loc.uri}`,
              range: {
                start: { line: loc.range.start.line, character: loc.range.start.character },
                end: { line: loc.range.end.line, character: loc.range.end.character },
              },
            }));

            showReferencesPanel(
              locations,
              symbolName,
              uri,
              { line: position.lineNumber - 1, character: position.column - 1 }
            );
          } catch (error) {
            console.error("Failed to find all references:", error);
          }
        },
      });
      
      // Add Peek Implementation action (Ctrl+Shift+F12)
      editorInstance.addAction({
        id: "editor.action.peekImplementation",
        label: "Peek Implementation",
        keybindings: [monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyMod.Shift | monacoInstance!.KeyCode.F12],
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
            (s) => !s.isEmpty()
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
            })
          );
          
          // Dispatch cursor changed event for navigation history tracking
          // Only track significant cursor moves (not programmatic moves from navigation)
          if (currentFile && monacoInstance && e.reason === monacoInstance!.editor.CursorChangeReason.Explicit) {
            window.dispatchEvent(
              new CustomEvent("editor:cursor-changed", {
                detail: {
                  filePath: currentFile.path,
                  line: position.lineNumber,
                  column: position.column,
                },
              })
            );
          }
        });

        editorInstance.onDidChangeCursorSelection(() => {
          if (!editorInstance) return;
          const selections = editorInstance.getSelections() || [];
          const cursorCount = selections.length;
          const selectionCount = selections.filter((s) => !s.isEmpty()).length;
          updateCursorInfo(cursorCount, selectionCount);
        });

        editorInstance.addCommand(
          monacoInstance!.KeyMod.CtrlCmd | monacoInstance!.KeyCode.KeyS,
          () => {
            const currentFile = activeFile();
            if (currentFile) saveFile(currentFile.id);
          }
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
            const range = getAbbreviationRange(model, position, monacoInstance!);
            if (!range) {
              editorInstance!.trigger("keyboard", "tab", null);
              return;
            }
            const abbreviation = model.getValueInRange(range);
            const expanded = expandEmmetAbbreviation(abbreviation, language);
            if (expanded) {
              editorInstance!.executeEdits("emmet", [{ range, text: expanded }]);
            } else {
              editorInstance!.trigger("keyboard", "tab", null);
            }
          },
          "editorTextFocus && !suggestWidgetVisible && !inSnippetMode"
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
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(deferredSetup, { timeout: 150 });
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
          50    // maxMessageLength
        );
      }
      console.debug(`[CodeEditor] Effect TOTAL: ${(performance.now() - effectStart).toFixed(1)}ms`);
    }
  });

  // Setup event listeners for external commands (goto-line, buffer-search-goto, editor-command)
  function setupEditorEventListeners(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) {
    // Clear previous event listeners
    eventCleanupFns.forEach((fn) => fn());
    eventCleanupFns.length = 0;

    // Handle goto-line event (from GoToLine dialog and ProjectSearch)
    const handleGotoLine = (e: CustomEvent<{ line: number; column?: number }>) => {
      const { line, column = 1 } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    // Handle editor:goto-line event (from ProjectSymbols)
    const handleEditorGotoLine = (e: CustomEvent<{ line: number; column?: number }>) => {
      const { line, column = 1 } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    // Handle outline:navigate event (from OutlinePanel symbol navigation)
    const handleOutlineNavigate = (e: CustomEvent<{ fileId: string; line: number; column: number }>) => {
      const currentFile = activeFile();
      if (!currentFile || e.detail.fileId !== currentFile.id) return;
      
      const { line, column } = e.detail;
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    // Handle buffer-search-goto event (from BufferSearch)
    const handleBufferSearchGoto = (e: CustomEvent<{ line: number; start: number; end: number }>) => {
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
        window.dispatchEvent(new CustomEvent("buffer-search:selection-response", {
          detail: {
            selection: {
              startLine: selection.startLineNumber,
              startColumn: selection.startColumn,
              endLine: selection.endLineNumber,
              endColumn: selection.endColumn,
            }
          }
        }));
      } else {
        window.dispatchEvent(new CustomEvent("buffer-search:selection-response", {
          detail: { selection: null }
        }));
      }
    };

    // Handle editor:get-selection-for-terminal event (from TerminalsContext for Run Selection)
    const handleGetSelectionForTerminal = () => {
      const model = editor.getModel();
      const selection = editor.getSelection();
      if (model && selection && !selection.isEmpty()) {
        const selectedText = model.getValueInRange(selection);
        window.dispatchEvent(new CustomEvent("editor:selection-for-terminal", {
          detail: { selection: selectedText }
        }));
      }
    };

    // Handle editor:get-active-file-for-terminal event (from TerminalsContext for Run File)
    const handleGetActiveFileForTerminal = () => {
      const currentFile = activeFile();
      if (currentFile?.path) {
        window.dispatchEvent(new CustomEvent("editor:active-file-for-terminal", {
          detail: { filePath: currentFile.path }
        }));
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
      if (command === "sort-lines-ascending" || command === "sort-lines-descending" ||
          command === "sort-lines-ascending-case-insensitive" || command === "sort-lines-descending-case-insensitive" ||
          command === "sort-lines-natural" || command === "sort-lines-by-length" ||
          command === "reverse-lines" || command === "shuffle-lines" || command === "remove-duplicate-lines") {
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
            sortedLines = [...lines].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            break;
          case "sort-lines-descending-case-insensitive":
            sortedLines = [...lines].sort((a, b) => b.toLowerCase().localeCompare(a.toLowerCase()));
            break;
          case "sort-lines-natural":
            sortedLines = [...lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
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
              [sortedLines[i], sortedLines[j]] = [sortedLines[j], sortedLines[i]];
            }
            break;
          case "remove-duplicate-lines": {
            const seen = new Set<string>();
            sortedLines = lines.filter(line => {
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
        editor.executeEdits('sortLines', [{
          range: {
            startLineNumber: startLine,
            startColumn: 1,
            endLineNumber: endLine,
            endColumn: model.getLineMaxColumn(endLine)
          },
          text: sortedLines.join('\n')
        }]);
        editor.pushUndoStop();
        editor.focus();
        return;
      }
      
const commandMap: Record<string, string> = {
        // Edit menu commands (undo, redo, clipboard operations)
        "undo": "undo",
        "redo": "redo",
        "cut": "editor.action.clipboardCutAction",
        "copy": "editor.action.clipboardCopyAction",
        "paste": "editor.action.clipboardPasteAction",
        "select-all": "editor.action.selectAll",
        // Multi-cursor commands
        "add-cursor-above": "editor.action.insertCursorAbove",
        "add-cursor-below": "editor.action.insertCursorBelow",
        "select-all-occurrences": "editor.action.selectHighlights",
        "add-selection-to-next-find-match": "editor.action.addSelectionToNextFindMatch",
        "add-cursors-to-line-ends": "editor.action.insertCursorAtEndOfEachLineSelected",
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
        "refactor": "editor.action.refactor",
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
      const currentOption = editor.getOption(monaco.editor.EditorOption.minimap);
      editor.updateOptions({ minimap: { enabled: !currentOption.enabled } });
    };

    // Handle toggle sticky scroll event
    const handleToggleStickyScroll = () => {
      const currentOption = editor.getOption(monaco.editor.EditorOption.stickyScroll);
      const newEnabled = !currentOption.enabled;
      editor.updateOptions({ stickyScroll: { enabled: newEnabled, maxLineCount: 5 } });
      // Persist the setting
      updateEditorSetting("stickyScrollEnabled", newEnabled);
    };

    // Handle toggle bracket pair colorization event
    const handleToggleBracketColorization = () => {
      const currentOption = editor.getOption(monaco.editor.EditorOption.bracketPairColorization);
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
      const currentOption = editor.getOption(monaco.editor.EditorOption.inlayHints);
      const currentEnabled = currentOption.enabled;
      const newEnabled: 'on' | 'off' = currentEnabled === 'on' ? 'off' : 'on';
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
      const newEnabled = !unicodeHighlightSettings.enabled;
      updateUnicodeHighlightSettings({ enabled: newEnabled });
      editor.updateOptions({
        unicodeHighlight: {
          ambiguousCharacters: newEnabled ? unicodeHighlightSettings.ambiguousCharacters : false,
          invisibleCharacters: newEnabled ? unicodeHighlightSettings.invisibleCharacters : false,
          nonBasicASCII: newEnabled ? unicodeHighlightSettings.nonBasicASCII : false,
        },
      });
    };

    // Handle unicode highlight settings change event
    const handleUnicodeHighlightSettingsChange = (e: CustomEvent<{
      enabled?: boolean;
      invisibleCharacters?: boolean;
      ambiguousCharacters?: boolean;
      nonBasicASCII?: boolean;
    }>) => {
      const { enabled, invisibleCharacters, ambiguousCharacters, nonBasicASCII } = e.detail;
      
      // Update global settings
      updateUnicodeHighlightSettings({
        enabled: enabled ?? unicodeHighlightSettings.enabled,
        invisibleCharacters: invisibleCharacters ?? unicodeHighlightSettings.invisibleCharacters,
        ambiguousCharacters: ambiguousCharacters ?? unicodeHighlightSettings.ambiguousCharacters,
        nonBasicASCII: nonBasicASCII ?? unicodeHighlightSettings.nonBasicASCII,
      });
      
      // Update editor options
      editor.updateOptions({
        unicodeHighlight: {
          ambiguousCharacters: ambiguousCharacters ?? unicodeHighlightSettings.ambiguousCharacters,
          invisibleCharacters: invisibleCharacters ?? unicodeHighlightSettings.invisibleCharacters,
          nonBasicASCII: nonBasicASCII ?? unicodeHighlightSettings.nonBasicASCII,
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
      const newEnabled = !formatOnTypeSettings.enabled;
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
    const handleFormatOnTypeSettingsChange = (e: CustomEvent<{
      enabled?: boolean;
      triggerCharacters?: string[];
    }>) => {
      const { enabled, triggerCharacters } = e.detail;
      
      // Update editor option
      if (enabled !== undefined) {
        editor.updateOptions({ formatOnType: enabled });
      }
      
      // Update global settings
      updateFormatOnTypeSettings({
        enabled: enabled ?? formatOnTypeSettings.enabled,
        triggerCharacters: triggerCharacters ?? formatOnTypeSettings.triggerCharacters,
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
    const handleCoverageVisibilityChanged = (e: CustomEvent<{ visible: boolean }>) => {
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
    const handleInlayHintsSettingsChange = (e: CustomEvent<{
      enabled?: 'on' | 'off' | 'onUnlessPressed' | 'offUnlessPressed';
      fontSize?: number;
      showParameterNames?: boolean;
      showTypeHints?: boolean;
    }>) => {
      const { enabled, fontSize, showParameterNames, showTypeHints } = e.detail;
      const currentOption = editor.getOption(monaco.editor.EditorOption.inlayHints);
      
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
        enabled: enabled ?? inlayHintSettings.enabled,
        fontSize: fontSize ?? inlayHintSettings.fontSize,
        showParameterNames: showParameterNames ?? inlayHintSettings.showParameterNames,
        showTypeHints: showTypeHints ?? inlayHintSettings.showTypeHints,
      });
    };

    // Handle buffer-search-highlights event (from BufferSearch)
    // Track decorations for cleanup
    let searchDecorations: string[] = [];
    
    const handleBufferSearchHighlights = (e: CustomEvent<{ 
      decorations: Array<{ 
        range: { startLine: number; startColumn: number; endLine: number; endColumn: number }; 
        isCurrent: boolean 
      }> 
    }>) => {
      const { decorations } = e.detail;
      const model = editor.getModel();
      if (!model) return;

      // Create Monaco decorations for search matches
      // Colors based on VS Code search highlight conventions:
      // - Current match: Bright yellow/orange for high visibility
      // - Other matches: Semi-transparent yellow for overview ruler
      const newDecorations = decorations.map(dec => ({
        range: new monaco.Range(
          dec.range.startLine,
          dec.range.startColumn,
          dec.range.endLine,
          dec.range.endColumn
        ),
        options: {
          className: dec.isCurrent ? "search-match-current" : "search-match",
          overviewRuler: {
            // Bright orange for current match, yellow/orange for others
            color: dec.isCurrent ? "rgba(249, 168, 37, 1)" : "rgba(230, 180, 60, 0.7)",
            position: monaco.editor.OverviewRulerLane.Center,
          },
          minimap: {
            color: dec.isCurrent ? "rgba(249, 168, 37, 1)" : "rgba(230, 180, 60, 0.7)",
            position: monaco.editor.MinimapPosition.Inline,
          },
        },
      }));

      // Update decorations (deltaDecorations handles cleanup of old ones)
      searchDecorations = editor.deltaDecorations(searchDecorations, newDecorations);
    };

    // ============================================================================
    // Debug Inline Values Decorations
    // ============================================================================
    
    let inlineValueDecorations: string[] = [];
    
    const updateInlineValueDecorations = (values: InlineValueInfo[], filePath: string) => {
      const model = editor.getModel();
      if (!model) {
        inlineValueDecorations = editor.deltaDecorations(inlineValueDecorations, []);
        return;
      }
      const currentFile = activeFile();
      if (!currentFile || currentFile.path !== filePath) {
        return;
      }
      const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];
      const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      for (const inlineValue of values) {
        const lineContent = model.getLineContent(inlineValue.line);
        const regex = new RegExp(`\\b${escapeRegExp(inlineValue.name)}\\b`, 'g');
        let match: RegExpExecArray | null;
        let firstMatch = true;
        
        while ((match = regex.exec(lineContent)) !== null) {
          if (firstMatch) {
            firstMatch = false;
            const endColumn = match.index + inlineValue.name.length + 1;
            newDecorations.push({
              range: new monaco.Range(inlineValue.line, endColumn, inlineValue.line, endColumn),
              options: {
                after: {
                  content: ` = ${inlineValue.value}`,
                  inlineClassName: "debug-inline-value",
                },
                hoverMessage: {
                  value: `**${inlineValue.name}**${inlineValue.type ? ` (${inlineValue.type})` : ''}\n\n\`\`\`\n${inlineValue.fullValue}\n\`\`\``,
                },
              },
            });
          }
        }
      }
      inlineValueDecorations = editor.deltaDecorations(inlineValueDecorations, newDecorations);
    };
    
    const clearInlineValueDecorations = () => {
      inlineValueDecorations = editor.deltaDecorations(inlineValueDecorations, []);
    };

    const handleDebugInlineValuesUpdated = (e: CustomEvent<{ path: string; values: InlineValueInfo[] }>) => {
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
        window.dispatchEvent(new CustomEvent("debug:toggle-breakpoint-at-line", {
          detail: { path: currentFile.path, line: position.lineNumber }
        }));
      }
    };

    /** Handle debug:jump-to-cursor-request - respond with current cursor position for jump */
    const handleDebugJumpToCursorRequest = (e: CustomEvent<{ path: string }>) => {
      const currentFile = activeFile();
      // Only handle if this editor is showing the target file
      if (!currentFile || e.detail.path !== currentFile.path) return;
      
      const position = editor.getPosition();
      if (position) {
        window.dispatchEvent(new CustomEvent("debug:jump-to-cursor-execute", {
          detail: { path: currentFile.path, line: position.lineNumber }
        }));
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
      window.dispatchEvent(new CustomEvent("emmet:selection-response", {
        detail: { text }
      }));
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
    const handleInlineBlameModeChange = (e: CustomEvent<{ mode: InlineBlameMode }>) => {
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
    let zenModeOriginalLineNumbers: "on" | "off" | "relative" | "interval" = "on";
    
    /** Handle Zen Mode enter - hide line numbers if setting enabled */
    const handleZenModeEnter = (e: CustomEvent<{ settings: { hideLineNumbers?: boolean } }>) => {
      const { settings } = e.detail || {};
      if (settings?.hideLineNumbers) {
        // Store current line numbers setting
        const currentOption = editor.getOption(monaco.editor.EditorOption.lineNumbers);
        zenModeOriginalLineNumbers = currentOption.renderType === 0 ? "off" 
          : currentOption.renderType === 1 ? "on"
          : currentOption.renderType === 2 ? "relative"
          : "interval";
        // Hide line numbers
        editor.updateOptions({ lineNumbers: "off" });
      }
    };
    
    /** Handle Zen Mode exit - restore line numbers if they were hidden */
    const handleZenModeExit = (e: CustomEvent<{ savedState?: { lineNumbers?: string } }>) => {
      const { savedState } = e.detail || {};
      // Restore line numbers to saved state or original setting
      const restoreTo = savedState?.lineNumbers as "on" | "off" | "relative" | "interval" 
        || zenModeOriginalLineNumbers 
        || "on";
      editor.updateOptions({ lineNumbers: restoreTo });
    };
    
    /** Handle explicit hide line numbers event from Zen Mode */
    const handleZenModeHideLineNumbers = () => {
      // Store current setting if not already stored
      const currentOption = editor.getOption(monaco.editor.EditorOption.lineNumbers);
      zenModeOriginalLineNumbers = currentOption.renderType === 0 ? "off" 
        : currentOption.renderType === 1 ? "on"
        : currentOption.renderType === 2 ? "relative"
        : "interval";
      editor.updateOptions({ lineNumbers: "off" });
    };
    
    /** Handle restore line numbers event from Zen Mode */
    const handleZenModeRestoreLineNumbers = (e: CustomEvent<{ lineNumbers?: string }>) => {
      const restoreTo = (e.detail?.lineNumbers as "on" | "off" | "relative" | "interval") 
        || zenModeOriginalLineNumbers 
        || "on";
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
    const handleSetCursorPosition = (e: CustomEvent<{ filePath: string; line: number; column: number }>) => {
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
    window.addEventListener("editor:goto-line", handleEditorGotoLine as EventListener);
    window.addEventListener("editor:set-cursor-position", handleSetCursorPosition as EventListener);
    window.addEventListener("outline:navigate", handleOutlineNavigate as EventListener);
    window.addEventListener("buffer-search-goto", handleBufferSearchGoto as EventListener);
    window.addEventListener("buffer-search-highlights", handleBufferSearchHighlights as EventListener);
    window.addEventListener("buffer-search:get-selection", handleBufferSearchGetSelection);
    window.addEventListener("editor-command", handleEditorCommand as unknown as EventListener);
    window.addEventListener("editor-format-document", handleFormatDocument);
    window.addEventListener("editor-toggle-word-wrap", handleToggleWordWrap);
    window.addEventListener("editor-toggle-minimap", handleToggleMinimap);
    window.addEventListener("editor-toggle-sticky-scroll", handleToggleStickyScroll);
    window.addEventListener("editor-toggle-bracket-colorization", handleToggleBracketColorization);
    window.addEventListener("editor-toggle-bracket-guides", handleToggleBracketGuides);
    window.addEventListener("editor-toggle-indentation-guides", handleToggleIndentationGuides);
    window.addEventListener("editor-toggle-inlay-hints", handleToggleInlayHints);
    window.addEventListener("editor-toggle-unicode-highlight", handleToggleUnicodeHighlight);
    window.addEventListener("editor-unicode-highlight-settings", handleUnicodeHighlightSettingsChange as EventListener);
    window.addEventListener("editor-toggle-linked-editing", handleToggleLinkedEditing);
    window.addEventListener("editor-toggle-format-on-type", handleToggleFormatOnType);
    window.addEventListener("editor-toggle-format-on-paste", handleToggleFormatOnPaste);
    window.addEventListener("editor-inlay-hints-settings", handleInlayHintsSettingsChange as EventListener);
    window.addEventListener("editor-format-on-type-settings", handleFormatOnTypeSettingsChange as EventListener);
    window.addEventListener("testing:coverage-updated", handleCoverageUpdated);
    window.addEventListener("testing:coverage-visibility-changed", handleCoverageVisibilityChanged as EventListener);
    window.addEventListener("testing:coverage-cleared", handleCoverageCleared);
    window.addEventListener("editor-toggle-coverage-decorations", handleToggleCoverageDecorations);
    window.addEventListener("debug:inlineValuesUpdated", handleDebugInlineValuesUpdated as EventListener);
    window.addEventListener("debug:cleared", handleDebugCleared);
    window.addEventListener("debug:toggle-breakpoint", handleDebugToggleBreakpoint as EventListener);
    window.addEventListener("debug:jump-to-cursor-request", handleDebugJumpToCursorRequest as EventListener);
    window.addEventListener("emmet:balance-inward", handleEmmetBalanceInward);
    window.addEventListener("emmet:balance-outward", handleEmmetBalanceOutward);
    window.addEventListener("emmet:get-selection", handleEmmetGetSelection);
    window.addEventListener("emmet:wrap", handleEmmetWrap as EventListener);
    window.addEventListener("inline-blame:mode-changed", handleInlineBlameModeChange as EventListener);
    window.addEventListener("inline-blame:toggle", handleToggleInlineBlame);
    window.addEventListener("git:go-to-next-change", handleGoToNextChange);
    window.addEventListener("git:go-to-prev-change", handleGoToPrevChange);
    window.addEventListener("editor:action", handleEditorAction as EventListener);
    window.addEventListener("zenmode:enter", handleZenModeEnter as EventListener);
    window.addEventListener("zenmode:exit", handleZenModeExit as EventListener);
    window.addEventListener("zenmode:hide-line-numbers", handleZenModeHideLineNumbers);
    window.addEventListener("zenmode:restore-line-numbers", handleZenModeRestoreLineNumbers as EventListener);
    window.addEventListener("editor:get-selection-for-terminal", handleGetSelectionForTerminal);
    window.addEventListener("editor:get-active-file-for-terminal", handleGetActiveFileForTerminal);

    // Store cleanup functions
    eventCleanupFns.push(
      () => window.removeEventListener("goto-line", handleGotoLine as EventListener),
      () => window.removeEventListener("editor:goto-line", handleEditorGotoLine as EventListener),
      () => window.removeEventListener("editor:set-cursor-position", handleSetCursorPosition as EventListener),
      () => window.removeEventListener("outline:navigate", handleOutlineNavigate as EventListener),
      () => window.removeEventListener("buffer-search-goto", handleBufferSearchGoto as EventListener),
      () => window.removeEventListener("buffer-search-highlights", handleBufferSearchHighlights as EventListener),
      () => window.removeEventListener("buffer-search:get-selection", handleBufferSearchGetSelection),
      () => window.removeEventListener("editor-command", handleEditorCommand as unknown as EventListener),
      () => window.removeEventListener("editor-format-document", handleFormatDocument),
      () => window.removeEventListener("editor-toggle-word-wrap", handleToggleWordWrap),
      () => window.removeEventListener("editor-toggle-minimap", handleToggleMinimap),
      () => window.removeEventListener("editor-toggle-sticky-scroll", handleToggleStickyScroll),
      () => window.removeEventListener("editor-toggle-bracket-colorization", handleToggleBracketColorization),
      () => window.removeEventListener("editor-toggle-bracket-guides", handleToggleBracketGuides),
      () => window.removeEventListener("editor-toggle-indentation-guides", handleToggleIndentationGuides),
      () => window.removeEventListener("editor-toggle-inlay-hints", handleToggleInlayHints),
      () => window.removeEventListener("editor-toggle-unicode-highlight", handleToggleUnicodeHighlight),
      () => window.removeEventListener("editor-unicode-highlight-settings", handleUnicodeHighlightSettingsChange as EventListener),
      () => window.removeEventListener("editor-toggle-linked-editing", handleToggleLinkedEditing),
      () => window.removeEventListener("editor-toggle-format-on-type", handleToggleFormatOnType),
      () => window.removeEventListener("editor-toggle-format-on-paste", handleToggleFormatOnPaste),
      () => window.removeEventListener("editor-inlay-hints-settings", handleInlayHintsSettingsChange as EventListener),
      () => window.removeEventListener("editor-format-on-type-settings", handleFormatOnTypeSettingsChange as EventListener),
      () => window.removeEventListener("testing:coverage-updated", handleCoverageUpdated),
      () => window.removeEventListener("testing:coverage-visibility-changed", handleCoverageVisibilityChanged as EventListener),
      () => window.removeEventListener("testing:coverage-cleared", handleCoverageCleared),
      () => window.removeEventListener("editor-toggle-coverage-decorations", handleToggleCoverageDecorations),
      () => window.removeEventListener("debug:inlineValuesUpdated", handleDebugInlineValuesUpdated as EventListener),
      () => window.removeEventListener("debug:cleared", handleDebugCleared),
      () => window.removeEventListener("debug:toggle-breakpoint", handleDebugToggleBreakpoint as EventListener),
      () => window.removeEventListener("debug:jump-to-cursor-request", handleDebugJumpToCursorRequest as EventListener),
      () => window.removeEventListener("emmet:balance-inward", handleEmmetBalanceInward),
      () => window.removeEventListener("emmet:balance-outward", handleEmmetBalanceOutward),
      () => window.removeEventListener("emmet:get-selection", handleEmmetGetSelection),
      () => window.removeEventListener("emmet:wrap", handleEmmetWrap as EventListener),
      () => window.removeEventListener("inline-blame:mode-changed", handleInlineBlameModeChange as EventListener),
      () => window.removeEventListener("inline-blame:toggle", handleToggleInlineBlame),
      () => window.removeEventListener("git:go-to-next-change", handleGoToNextChange),
      () => window.removeEventListener("git:go-to-prev-change", handleGoToPrevChange),
      () => window.removeEventListener("editor:action", handleEditorAction as EventListener),
      () => window.removeEventListener("zenmode:enter", handleZenModeEnter as EventListener),
      () => window.removeEventListener("zenmode:exit", handleZenModeExit as EventListener),
      () => window.removeEventListener("zenmode:hide-line-numbers", handleZenModeHideLineNumbers),
      () => window.removeEventListener("zenmode:restore-line-numbers", handleZenModeRestoreLineNumbers as EventListener),
      () => window.removeEventListener("editor:get-selection-for-terminal", handleGetSelectionForTerminal),
      () => window.removeEventListener("editor:get-active-file-for-terminal", handleGetActiveFileForTerminal),
      () => { searchDecorations = editor.deltaDecorations(searchDecorations, []); }, // Clear search decorations on cleanup
      () => { clearCoverageDecorations(editor); }, // Clear coverage decorations on cleanup
      () => { clearInlineValueDecorations(); }, // Clear debug inline values on cleanup
      () => { if (inlineBlameManager) { inlineBlameManager.dispose(); inlineBlameManager = null; } } // Clear inline blame on cleanup
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
    _fileId: string
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
        ed.trigger("keyboard", "editor.action.addSelectionToNextFindMatch", null);
      },
    });

    editor.addAction({
      id: "add-cursors-to-line-ends",
      label: "Add Cursors to Line Ends",
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyI,
      ],
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.insertCursorAtEndOfEachLineSelected", null);
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
        await smartSelectManager.expandSelection(ed as Monaco.editor.IStandaloneCodeEditor, monaco);
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
        smartSelectManager.shrinkSelection(ed as Monaco.editor.IStandaloneCodeEditor, monaco);
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
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD],
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
              range: new monaco.Range(lineNumber, lineEndColumn, lineNumber, lineEndColumn),
              text: "\n" + lineContent,
            });
            
            newSelections.push(
              new monaco.Selection(
                lineNumber + 1,
                selection.startColumn,
                lineNumber + 1,
                selection.endColumn
              )
            );
          } else {
            edits.push({
              range: new monaco.Range(
                selection.endLineNumber,
                selection.endColumn,
                selection.endLineNumber,
                selection.endColumn
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
                  : newStartColumn + text.length
              )
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
      { id: 'transform-to-snakecase', label: 'Transform to snake_case', fn: toSnakeCase },
      { id: 'transform-to-camelcase', label: 'Transform to camelCase', fn: toCamelCase },
      { id: 'transform-to-pascalcase', label: 'Transform to PascalCase', fn: toPascalCase },
      { id: 'transform-to-kebabcase', label: 'Transform to kebab-case', fn: toKebabCase },
      { id: 'transform-to-constantcase', label: 'Transform to CONSTANT_CASE', fn: toConstantCase },
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
          
          const edits = selections.map(sel => ({
            range: sel,
            text: fn(model.getValueInRange(sel))
          }));
          
          ed.executeEdits('transform', edits);
          ed.pushUndoStop();
        }
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
        const startLine = Math.min(columnSelectStart.lineNumber, e.target.position.lineNumber);
        const endLine = Math.max(columnSelectStart.lineNumber, e.target.position.lineNumber);
        const startColumn = Math.min(columnSelectStart.column, e.target.position.column);
        const endColumn = Math.max(columnSelectStart.column, e.target.position.column);

        const selections: Monaco.Selection[] = [];
        for (let line = startLine; line <= endLine; line++) {
          selections.push(
            new monaco.Selection(line, startColumn, line, endColumn)
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
        editor.trigger("keyboard", "editor.action.addSelectionToNextFindMatch", null);
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
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.F3],
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
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.Backslash,
      ],
      run: (ed) => {
        ed.trigger("keyboard", "editor.action.selectToBracket", null);
      },
    });

    // Peek Definition - Alt+F12 (show definition inline without navigating)
    editor.addAction({
      id: "editor.action.peekDefinition",
      label: "Peek Definition",
      keybindings: [
        monaco.KeyMod.Alt | monaco.KeyCode.F12,
      ],
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
          const result = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_multi_definition", {
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
            const standardResult = await invoke<{ locations: Array<{ uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> }>("lsp_definition", {
              serverId: languageId,
              params: {
                uri: filePath,
                position: {
                  line: position.lineNumber - 1,
                  character: position.column - 1,
                },
              },
            });

            if (!standardResult || !standardResult.locations || standardResult.locations.length === 0) {
              console.debug("No definition found for peek");
              return;
            }

            // Convert LSP locations to PeekLocation format
            const peekLocations: PeekLocation[] = standardResult.locations.map((loc) => ({
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
      keybindings: [
        monaco.KeyCode.Escape,
      ],
      precondition: undefined,
      run: () => {
        hidePeekWidget();
      },
    });
  }

  // Listen for language change events from the language selector
  createEffect(() => {
    const handleLanguageChange = (e: CustomEvent<{ fileId: string; languageId: string }>) => {
      if (!e.detail) return;
      const file = activeFile();
      if (!file || !editorInstance || !monacoInstance) return;
      
      // Only update if the change is for the current file
      if (e.detail.fileId !== file.id) return;
      
      const model = editorInstance.getModel();
      if (model) {
        const monacoLanguage = languageMap[e.detail.languageId] || e.detail.languageId || "plaintext";
        monacoInstance!.editor.setModelLanguage(model, monacoLanguage);
      }
    };

    window.addEventListener("language:changed", handleLanguageChange as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("language:changed", handleLanguageChange as EventListener);
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
  
  const handleAgentActive = (e: CustomEvent<{ 
    path?: string; 
    paths?: string[]; 
    action: string; 
    duration: number;
    allSplits?: boolean;
  }>) => {
    const file = activeFile();
    const detail = e.detail;
    
    // Check if this editor should show orange border
    const shouldActivate = detail.allSplits || // All splits should be orange
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
  
  window.addEventListener("editor:agentActive", handleAgentActive as EventListener);
  window.addEventListener("editor:agentInactive", handleAgentInactive);
  
  onCleanup(() => {
    window.removeEventListener("editor:agentActive", handleAgentActive as EventListener);
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
        console.debug("[CodeEditor] Pre-close disposal error (safe to ignore):", err);
      }
    }
  };
  
  window.addEventListener('editor:file-closed', handleFileClose as EventListener);
  window.addEventListener('editor:file-closing', handleFileClosing as EventListener);
  
  // Periodic cache pruning to clean up stale entries (every 60 seconds)
  const smartSelectPruneInterval = setInterval(() => {
    smartSelectManager.pruneOldCaches();
  }, 60000);
  
  onCleanup(() => {
    // Clean up SmartSelectManager cache pruning interval
    clearInterval(smartSelectPruneInterval);
    
    // Remove file close event listeners
    window.removeEventListener('editor:file-closed', handleFileClose as EventListener);
    window.removeEventListener('editor:file-closing', handleFileClosing as EventListener);
    
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
    debugHoverState = null;
    updateDebugHoverState(null);
    
    // Dispose debug hover provider
    disposeDebugHoverProvider();
    
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
        console.debug("[CodeEditor] Cleanup disposal error (safe to ignore):", e);
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
        
        editorInstance.executeEdits("drop-files", [{
          range: new monacoInstance!.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          text: textToInsert,
        }]);
        
        // Move cursor to end of inserted text
        const lines = textToInsert.split("\n");
        const lastLine = lines[lines.length - 1];
        const newPosition = {
          lineNumber: position.lineNumber + lines.length - 1,
          column: lines.length === 1 ? position.column + lastLine.length : lastLine.length + 1,
        };
        editorInstance.setPosition(newPosition);
        editorInstance.focus();
        return;
      }
    }

    // Handle dropped text
    const droppedText = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text");
    if (droppedText) {
      editorInstance.executeEdits("drop-text", [{
        range: new monacoInstance!.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        text: droppedText,
      }]);
      
      // Move cursor to end of inserted text
      const lines = droppedText.split("\n");
      const lastLine = lines[lines.length - 1];
      const newPosition = {
        lineNumber: position.lineNumber + lines.length - 1,
        column: lines.length === 1 ? position.column + lastLine.length : lastLine.length + 1,
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
        "box-shadow": agentActive() ? "inset 0 0 0 2px var(--cortex-warning)" : "none", // Orange border when agent is active
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
            "border": "2px solid var(--jb-color-warning, var(--cortex-warning))",
            "border-radius": "var(--cortex-radius-sm)",
          }}
        />
      </Show>
      {/* Drop indicator overlay - shown when dragging files/text over editor */}
      <Show when={isDraggingOver()}>
        <div 
          class="absolute inset-0 pointer-events-none z-40 flex items-center justify-center"
          style={{
            "background": "rgba(99, 102, 241, 0.15)",
            "border": "2px dashed var(--jb-border-focus, var(--cortex-info))",
            "border-radius": "var(--cortex-radius-sm)",
          }}
        >
          <div 
            class="px-4 py-2 rounded-lg"
            style={{
              "background": "var(--jb-panel)",
              "border": "1px solid var(--jb-border-focus, var(--cortex-info))",
              "color": "var(--jb-text-body-color)",
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
          const filePath = location.uri.replace(/^file:\/\//, "").replace(/\//g, "\\");
          window.dispatchEvent(new CustomEvent("editor:openFile", {
            detail: {
              path: filePath,
              line: location.range.startLineNumber,
              column: location.range.startColumn,
            },
          }));
        }}
      />
      {/* Peek References Widget - Inline references preview */}
      <PeekReferences
        editor={currentEditor()}
        monaco={currentMonaco()}
        onNavigate={(uri, line, column) => {
          // Navigate to the reference file
          const filePath = uri.replace(/^file:\/\//, "").replace(/\//g, "\\");
          window.dispatchEvent(new CustomEvent("editor:openFile", {
            detail: {
              path: filePath,
              line: line,
              column: column,
            },
          }));
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
          window.dispatchEvent(new CustomEvent("editor:find-matches-change", {
            detail: { count, current },
          }));
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
        onRename={(oldName: string, newName: string, locations: RenameLocation[]) => {
          // Rename completed successfully
          console.debug(`[RenameWidget] Renamed "${oldName}" to "${newName}" in ${locations.length} locations`);
          // Trigger file content refresh for affected files
          window.dispatchEvent(new CustomEvent("editor:refresh-content", {
            detail: { locations },
          }));
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
      <Show when={debug.state.isPaused && debug.getExceptionWidgetState().visible}>
        <ExceptionWidget
          lineHeight={20}
          editorTopOffset={0}
          onContinue={() => debug.continue_()}
          onConfigureBreakpoint={(exceptionId) => {
            editorLogger.debug("Configure breakpoint for exception:", exceptionId);
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

