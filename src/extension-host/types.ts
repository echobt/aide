/**
 * Extension Host Type Definitions
 *
 * Core type definitions for the extension host system including
 * API interfaces, messages, events, and extension lifecycle types.
 */

// ============================================================================
// Disposable Pattern
// ============================================================================

/**
 * Represents a resource that can be disposed.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Helper to create a disposable from a function.
 */
export function createDisposable(fn: () => void): Disposable {
  return { dispose: fn };
}

/**
 * Manages a collection of disposables.
 */
export class DisposableStore implements Disposable {
  private readonly _disposables = new Set<Disposable>();
  private _isDisposed = false;

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  add<T extends Disposable>(disposable: T): T {
    if (this._isDisposed) {
      disposable.dispose();
    } else {
      this._disposables.add(disposable);
    }
    return disposable;
  }

  delete(disposable: Disposable): void {
    this._disposables.delete(disposable);
  }

  clear(): void {
    this._disposables.forEach((d) => {
      try {
        d.dispose();
      } catch (e) {
        console.error("[DisposableStore] Error disposing:", e);
      }
    });
    this._disposables.clear();
  }

  dispose(): void {
    if (!this._isDisposed) {
      this._isDisposed = true;
      this.clear();
    }
  }
}

/**
 * Disposable that can be set to a new value.
 */
export class MutableDisposable<T extends Disposable> implements Disposable {
  private _value: T | undefined;
  private _isDisposed = false;

  get value(): T | undefined {
    return this._value;
  }

  set value(value: T | undefined) {
    if (this._isDisposed) {
      value?.dispose();
      return;
    }
    this._value?.dispose();
    this._value = value;
  }

  dispose(): void {
    this._isDisposed = true;
    this._value?.dispose();
    this._value = undefined;
  }
}

// ============================================================================
// Event System
// ============================================================================

/**
 * Event handler signature.
 */
export type EventHandler<T> = (event: T) => void;

/**
 * Event that can be subscribed to.
 */
export interface Event<T> {
  (listener: EventHandler<T>): Disposable;
}

/**
 * Event emitter for creating events.
 */
export class EventEmitter<T> implements Disposable {
  private readonly _listeners = new Set<EventHandler<T>>();
  private _disposed = false;

  /**
   * The event that can be subscribed to.
   */
  readonly event: Event<T> = (listener: EventHandler<T>): Disposable => {
    if (this._disposed) {
      return createDisposable(() => {});
    }
    this._listeners.add(listener);
    return createDisposable(() => this._listeners.delete(listener));
  };

  /**
   * Fire the event with data.
   */
  fire(data: T): void {
    if (!this._disposed) {
      // Copy listeners to avoid issues if listener modifies the set
      const listeners = [...this._listeners];
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (e) {
          console.error("[EventEmitter] Listener error:", e);
        }
      }
    }
  }

  /**
   * Check if there are any listeners.
   */
  hasListeners(): boolean {
    return this._listeners.size > 0;
  }

  dispose(): void {
    this._disposed = true;
    this._listeners.clear();
  }
}

/**
 * Relay an event from one emitter to another.
 */
export function relayEvent<T>(
  source: Event<T>,
  target: EventEmitter<T>
): Disposable {
  return source((e) => target.fire(e));
}

// ============================================================================
// URI and Position Types
// ============================================================================

/**
 * Represents a URI (file path or resource identifier).
 */
export interface Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
  readonly fsPath: string;
  toString(): string;
  with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri;
  toJSON(): { scheme: string; authority: string; path: string; query: string; fragment: string };
}

/**
 * Creates a URI from a file path.
 */
export function createUri(pathOrUri: string): Uri {
  // Check if it's already a URI string
  if (pathOrUri.includes("://")) {
    try {
      const url = new URL(pathOrUri);
      return createUriImpl(
        url.protocol.replace(":", ""),
        url.host,
        decodeURIComponent(url.pathname),
        url.search.replace("?", ""),
        url.hash.replace("#", "")
      );
    } catch {
      // Fall through to file handling
    }
  }

  const normalized = pathOrUri.replace(/\\/g, "/");
  return createUriImpl("file", "", normalized, "", "");
}

function createUriImpl(
  scheme: string,
  authority: string,
  path: string,
  query: string,
  fragment: string
): Uri {
  const uri: Uri = {
    scheme,
    authority,
    path,
    query,
    fragment,
    get fsPath(): string {
      // Convert to platform-specific path
      if (scheme !== "file") return path;
      // Handle Windows paths
      if (/^\/[a-zA-Z]:/.test(path)) {
        return path.slice(1).replace(/\//g, "\\");
      }
      return path;
    },
    toString(): string {
      let result = `${scheme}://`;
      if (authority) result += authority;
      result += path;
      if (query) result += `?${query}`;
      if (fragment) result += `#${fragment}`;
      return result;
    },
    with(change): Uri {
      return createUriImpl(
        change.scheme ?? scheme,
        change.authority ?? authority,
        change.path ?? path,
        change.query ?? query,
        change.fragment ?? fragment
      );
    },
    toJSON() {
      return { scheme, authority, path, query, fragment };
    },
  };
  return uri;
}

/**
 * Represents a position in a text document.
 */
export interface Position {
  readonly line: number;
  readonly character: number;
  isEqual(other: Position): boolean;
  isBefore(other: Position): boolean;
  isAfter(other: Position): boolean;
  isBeforeOrEqual(other: Position): boolean;
  isAfterOrEqual(other: Position): boolean;
  compareTo(other: Position): number;
  translate(lineDelta?: number, characterDelta?: number): Position;
  with(line?: number, character?: number): Position;
}

/**
 * Creates a position.
 */
export function createPosition(line: number, character: number): Position {
  const pos: Position = {
    line: Math.max(0, line),
    character: Math.max(0, character),
    isEqual(other: Position): boolean {
      return pos.line === other.line && pos.character === other.character;
    },
    isBefore(other: Position): boolean {
      return pos.compareTo(other) < 0;
    },
    isAfter(other: Position): boolean {
      return pos.compareTo(other) > 0;
    },
    isBeforeOrEqual(other: Position): boolean {
      return pos.compareTo(other) <= 0;
    },
    isAfterOrEqual(other: Position): boolean {
      return pos.compareTo(other) >= 0;
    },
    compareTo(other: Position): number {
      if (pos.line < other.line) return -1;
      if (pos.line > other.line) return 1;
      if (pos.character < other.character) return -1;
      if (pos.character > other.character) return 1;
      return 0;
    },
    translate(lineDelta = 0, characterDelta = 0): Position {
      return createPosition(pos.line + lineDelta, pos.character + characterDelta);
    },
    with(newLine?: number, newCharacter?: number): Position {
      return createPosition(newLine ?? pos.line, newCharacter ?? pos.character);
    },
  };
  return pos;
}

/**
 * Represents a text range.
 */
export interface Range {
  readonly start: Position;
  readonly end: Position;
  readonly isEmpty: boolean;
  readonly isSingleLine: boolean;
  contains(positionOrRange: Position | Range): boolean;
  isEqual(other: Range): boolean;
  intersection(other: Range): Range | undefined;
  union(other: Range): Range;
  with(start?: Position, end?: Position): Range;
}

/**
 * Creates a range.
 */
export function createRange(
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number
): Range;
export function createRange(start: Position, end: Position): Range;
export function createRange(
  startLineOrPos: number | Position,
  startCharOrEnd: number | Position,
  endLine?: number,
  endChar?: number
): Range {
  let start: Position;
  let end: Position;

  if (typeof startLineOrPos === "number") {
    start = createPosition(startLineOrPos, startCharOrEnd as number);
    end = createPosition(endLine!, endChar!);
  } else {
    start = startLineOrPos;
    end = startCharOrEnd as Position;
  }

  // Normalize: ensure start <= end
  if (start.isAfter(end)) {
    [start, end] = [end, start];
  }

  const range: Range = {
    start,
    end,
    get isEmpty(): boolean {
      return start.isEqual(end);
    },
    get isSingleLine(): boolean {
      return start.line === end.line;
    },
    contains(positionOrRange: Position | Range): boolean {
      if ("start" in positionOrRange) {
        return range.contains(positionOrRange.start) && range.contains(positionOrRange.end);
      }
      return (
        positionOrRange.isAfterOrEqual(start) && positionOrRange.isBeforeOrEqual(end)
      );
    },
    isEqual(other: Range): boolean {
      return start.isEqual(other.start) && end.isEqual(other.end);
    },
    intersection(other: Range): Range | undefined {
      const newStart = start.isAfter(other.start) ? start : other.start;
      const newEnd = end.isBefore(other.end) ? end : other.end;
      if (newStart.isAfter(newEnd)) return undefined;
      return createRange(newStart, newEnd);
    },
    union(other: Range): Range {
      const newStart = start.isBefore(other.start) ? start : other.start;
      const newEnd = end.isAfter(other.end) ? end : other.end;
      return createRange(newStart, newEnd);
    },
    with(newStart?: Position, newEnd?: Position): Range {
      return createRange(newStart ?? start, newEnd ?? end);
    },
  };

  return range;
}

/**
 * Represents a selection in the editor.
 */
export interface Selection extends Range {
  readonly anchor: Position;
  readonly active: Position;
  readonly isReversed: boolean;
}

/**
 * Creates a selection.
 */
export function createSelection(
  anchorLine: number,
  anchorChar: number,
  activeLine: number,
  activeChar: number
): Selection;
export function createSelection(anchor: Position, active: Position): Selection;
export function createSelection(
  anchorLineOrPos: number | Position,
  anchorCharOrActive: number | Position,
  activeLine?: number,
  activeChar?: number
): Selection {
  let anchor: Position;
  let active: Position;

  if (typeof anchorLineOrPos === "number") {
    anchor = createPosition(anchorLineOrPos, anchorCharOrActive as number);
    active = createPosition(activeLine!, activeChar!);
  } else {
    anchor = anchorLineOrPos;
    active = anchorCharOrActive as Position;
  }

  const isReversed = anchor.isAfter(active);
  const start = isReversed ? active : anchor;
  const end = isReversed ? anchor : active;
  const range = createRange(start, end);

  return {
    ...range,
    anchor,
    active,
    isReversed,
  };
}

// ============================================================================
// Text Document Types
// ============================================================================

/**
 * Represents a text document.
 */
export interface TextDocument {
  readonly uri: Uri;
  readonly fileName: string;
  readonly languageId: string;
  readonly version: number;
  readonly isDirty: boolean;
  readonly isUntitled: boolean;
  readonly isClosed: boolean;
  readonly lineCount: number;
  readonly eol: EndOfLine;

  getText(range?: Range): string;
  getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
  lineAt(line: number): TextLine;
  lineAt(position: Position): TextLine;
  offsetAt(position: Position): number;
  positionAt(offset: number): Position;
  validateRange(range: Range): Range;
  validatePosition(position: Position): Position;
  save(): Promise<boolean>;
}

/**
 * Represents a line of text.
 */
export interface TextLine {
  readonly lineNumber: number;
  readonly text: string;
  readonly range: Range;
  readonly rangeIncludingLineBreak: Range;
  readonly firstNonWhitespaceCharacterIndex: number;
  readonly isEmptyOrWhitespace: boolean;
}

/**
 * End of line sequence.
 */
export enum EndOfLine {
  LF = 1,
  CRLF = 2,
}

/**
 * Text document change event.
 */
export interface TextDocumentChangeEvent {
  readonly document: TextDocument;
  readonly contentChanges: readonly TextDocumentContentChangeEvent[];
  readonly reason: TextDocumentChangeReason | undefined;
}

/**
 * Content change in a text document.
 */
export interface TextDocumentContentChangeEvent {
  readonly range: Range;
  readonly rangeOffset: number;
  readonly rangeLength: number;
  readonly text: string;
}

/**
 * Reason for text document change.
 */
export enum TextDocumentChangeReason {
  Undo = 1,
  Redo = 2,
}

// ============================================================================
// Workspace Types
// ============================================================================

/**
 * Represents a workspace folder.
 */
export interface WorkspaceFolder {
  readonly uri: Uri;
  readonly name: string;
  readonly index: number;
}

/**
 * Configuration object.
 */
export interface WorkspaceConfiguration {
  get<T>(section: string): T | undefined;
  get<T>(section: string, defaultValue: T): T;
  has(section: string): boolean;
  inspect<T>(section: string): ConfigurationInspect<T> | undefined;
  update(
    section: string,
    value: unknown,
    configurationTarget?: ConfigurationTarget | boolean,
    overrideInLanguage?: boolean
  ): Promise<void>;
}

/**
 * Configuration inspection result.
 */
export interface ConfigurationInspect<T> {
  key: string;
  defaultValue?: T;
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
  defaultLanguageValue?: T;
  globalLanguageValue?: T;
  workspaceLanguageValue?: T;
  workspaceFolderLanguageValue?: T;
  languageIds?: string[];
}

/**
 * Configuration target.
 */
export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

// ============================================================================
// Window Types
// ============================================================================

/**
 * Output channel for extension logging.
 */
export interface OutputChannel {
  readonly name: string;
  append(value: string): void;
  appendLine(value: string): void;
  replace(value: string): void;
  clear(): void;
  show(preserveFocus?: boolean): void;
  show(column?: ViewColumn, preserveFocus?: boolean): void;
  hide(): void;
  dispose(): void;
}

/**
 * Log output channel with additional logging methods.
 */
export interface LogOutputChannel extends OutputChannel {
  readonly logLevel: LogLevel;
  readonly onDidChangeLogLevel: Event<LogLevel>;
  trace(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string | Error, ...args: unknown[]): void;
}

/**
 * View column for editor placement.
 */
export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
}

/**
 * Quick pick item.
 */
export interface QuickPickItem {
  label: string;
  kind?: QuickPickItemKind;
  description?: string;
  detail?: string;
  picked?: boolean;
  alwaysShow?: boolean;
  buttons?: QuickInputButton[];
}

/**
 * Quick pick item kind.
 */
export enum QuickPickItemKind {
  Separator = -1,
  Default = 0,
}

/**
 * Quick input button.
 */
export interface QuickInputButton {
  readonly iconPath: Uri | ThemeIcon | { light: Uri; dark: Uri };
  readonly tooltip?: string;
}

/**
 * Theme icon.
 */
export interface ThemeIcon {
  readonly id: string;
  readonly color?: ThemeColor;
}

/**
 * Theme color.
 */
export interface ThemeColor {
  readonly id: string;
}

/**
 * Quick pick options.
 */
export interface QuickPickOptions {
  title?: string;
  placeHolder?: string;
  canPickMany?: boolean;
  ignoreFocusOut?: boolean;
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
}

/**
 * Input box options.
 */
export interface InputBoxOptions {
  title?: string;
  value?: string;
  valueSelection?: [number, number];
  prompt?: string;
  placeHolder?: string;
  password?: boolean;
  ignoreFocusOut?: boolean;
  validateInput?(value: string): string | undefined | null | Promise<string | undefined | null>;
}

/**
 * Message options.
 */
export interface MessageOptions {
  modal?: boolean;
  detail?: string;
}

/**
 * Message item (action button).
 */
export interface MessageItem {
  title: string;
  isCloseAffordance?: boolean;
}

/**
 * Progress location.
 */
export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

/**
 * Progress options.
 */
export interface ProgressOptions {
  location: ProgressLocation | { viewId: string };
  title?: string;
  cancellable?: boolean;
}

/**
 * Progress reporter.
 */
export interface Progress<T> {
  report(value: T): void;
}

/**
 * Cancellation token.
 */
export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  readonly onCancellationRequested: Event<void>;
}

/**
 * Cancellation token source.
 */
export class CancellationTokenSource implements Disposable {
  private _token: CancellationToken | undefined;
  private _cancelled = false;
  private readonly _emitter = new EventEmitter<void>();

  get token(): CancellationToken {
    if (!this._token) {
      this._token = {
        isCancellationRequested: this._cancelled,
        onCancellationRequested: this._emitter.event,
      };
    }
    return this._token;
  }

  cancel(): void {
    if (!this._cancelled) {
      this._cancelled = true;
      this._emitter.fire();
    }
  }

  dispose(): void {
    this.cancel();
    this._emitter.dispose();
  }
}

/**
 * Status bar alignment.
 */
export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

/**
 * Status bar item.
 */
export interface StatusBarItem {
  readonly id: string;
  alignment: StatusBarAlignment;
  priority: number;
  name: string | undefined;
  text: string;
  tooltip: string | MarkdownString | undefined;
  color: string | ThemeColor | undefined;
  backgroundColor: ThemeColor | undefined;
  command: string | Command | undefined;
  accessibilityInformation: AccessibilityInformation | undefined;
  show(): void;
  hide(): void;
  dispose(): void;
}

/**
 * Command structure.
 */
export interface Command {
  title: string;
  command: string;
  tooltip?: string;
  arguments?: unknown[];
}

/**
 * Accessibility information.
 */
export interface AccessibilityInformation {
  label: string;
  role?: string;
}

// ============================================================================
// Language Types
// ============================================================================

/**
 * Document selector for language features.
 */
export type DocumentSelector = (string | DocumentFilter)[];

/**
 * Document filter.
 */
export interface DocumentFilter {
  language?: string;
  scheme?: string;
  pattern?: string;
  notebookType?: string;
}

/**
 * Completion item kinds.
 */
export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  File = 16,
  Reference = 17,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24,
}

/**
 * Completion item.
 */
export interface CompletionItem {
  label: string | CompletionItemLabel;
  kind?: CompletionItemKind;
  tags?: CompletionItemTag[];
  detail?: string;
  documentation?: string | MarkdownString;
  sortText?: string;
  filterText?: string;
  insertText?: string | SnippetString;
  range?: Range | { inserting: Range; replacing: Range };
  preselect?: boolean;
  commitCharacters?: string[];
  keepWhitespace?: boolean;
  additionalTextEdits?: TextEdit[];
  command?: Command;
}

/**
 * Completion item tag.
 */
export enum CompletionItemTag {
  Deprecated = 1,
}

/**
 * Completion item label.
 */
export interface CompletionItemLabel {
  label: string;
  detail?: string;
  description?: string;
}

/**
 * Snippet string.
 */
export interface SnippetString {
  value: string;
  appendText(string: string): SnippetString;
  appendTabstop(number?: number): SnippetString;
  appendPlaceholder(value: string | ((snippet: SnippetString) => unknown), number?: number): SnippetString;
  appendChoice(values: string[], number?: number): SnippetString;
  appendVariable(name: string, defaultValue?: string | ((snippet: SnippetString) => unknown)): SnippetString;
}

/**
 * Create a snippet string.
 */
export function createSnippetString(value = ""): SnippetString {
  let currentValue = value;
  let currentTabstop = 0;

  const snippet: SnippetString = {
    get value(): string {
      return currentValue;
    },
    set value(v: string) {
      currentValue = v;
    },
    appendText(text: string): SnippetString {
      currentValue += text.replace(/[$\\}]/g, "\\$&");
      return snippet;
    },
    appendTabstop(number?: number): SnippetString {
      currentValue += `\$${number ?? ++currentTabstop}`;
      return snippet;
    },
    appendPlaceholder(
      value: string | ((snippet: SnippetString) => unknown),
      number?: number
    ): SnippetString {
      const n = number ?? ++currentTabstop;
      if (typeof value === "function") {
        const nested = createSnippetString();
        value(nested);
        currentValue += `\${${n}:${nested.value}}`;
      } else {
        currentValue += `\${${n}:${value.replace(/[$\\}]/g, "\\$&")}}`;
      }
      return snippet;
    },
    appendChoice(values: string[], number?: number): SnippetString {
      const n = number ?? ++currentTabstop;
      const escaped = values.map((v) => v.replace(/[$\\|,}]/g, "\\$&"));
      currentValue += `\${${n}|${escaped.join(",")}|}`;
      return snippet;
    },
    appendVariable(
      name: string,
      defaultValue?: string | ((snippet: SnippetString) => unknown)
    ): SnippetString {
      if (defaultValue !== undefined) {
        if (typeof defaultValue === "function") {
          const nested = createSnippetString();
          defaultValue(nested);
          currentValue += `\${${name}:${nested.value}}`;
        } else {
          currentValue += `\${${name}:${defaultValue.replace(/[$\\}]/g, "\\$&")}}`;
        }
      } else {
        currentValue += `\$${name}`;
      }
      return snippet;
    },
  };

  return snippet;
}

/**
 * Markdown string.
 */
export interface MarkdownString {
  value: string;
  isTrusted?: boolean | { enabledCommands: string[] };
  supportThemeIcons?: boolean;
  supportHtml?: boolean;
  baseUri?: Uri;
  appendText(value: string): MarkdownString;
  appendMarkdown(value: string): MarkdownString;
  appendCodeblock(value: string, language?: string): MarkdownString;
}

/**
 * Create a markdown string.
 */
export function createMarkdownString(value = "", isTrusted = false): MarkdownString {
  let currentValue = value;

  const md: MarkdownString = {
    get value(): string {
      return currentValue;
    },
    set value(v: string) {
      currentValue = v;
    },
    isTrusted,
    supportThemeIcons: false,
    supportHtml: false,
    appendText(text: string): MarkdownString {
      // Escape markdown special characters
      currentValue += text.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
      return md;
    },
    appendMarkdown(markdown: string): MarkdownString {
      currentValue += markdown;
      return md;
    },
    appendCodeblock(code: string, language = ""): MarkdownString {
      currentValue += `\n\`\`\`${language}\n${code}\n\`\`\`\n`;
      return md;
    },
  };

  return md;
}

/**
 * Text edit.
 */
export interface TextEdit {
  range: Range;
  newText: string;
}

/**
 * Create a text edit.
 */
export function createTextEdit(range: Range, newText: string): TextEdit {
  return { range, newText };
}

/**
 * Completion list.
 */
export interface CompletionList {
  isIncomplete: boolean;
  items: CompletionItem[];
}

/**
 * Completion context.
 */
export interface CompletionContext {
  readonly triggerKind: CompletionTriggerKind;
  readonly triggerCharacter?: string;
}

/**
 * Completion trigger kind.
 */
export enum CompletionTriggerKind {
  Invoke = 0,
  TriggerCharacter = 1,
  TriggerForIncompleteCompletions = 2,
}

/**
 * Completion item provider.
 */
export interface CompletionItemProvider<T extends CompletionItem = CompletionItem> {
  provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext
  ): T[] | CompletionList | Promise<T[] | CompletionList | undefined | null>;
  resolveCompletionItem?(
    item: T,
    token: CancellationToken
  ): T | Promise<T | undefined | null>;
}

/**
 * Hover.
 */
export interface Hover {
  contents: MarkdownString | MarkdownString[] | string;
  range?: Range;
}

/**
 * Hover provider.
 */
export interface HoverProvider {
  provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Hover | undefined | null | Promise<Hover | undefined | null>;
}

/**
 * Definition provider.
 */
export interface DefinitionProvider {
  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Definition | DefinitionLink[] | undefined | null | Promise<Definition | DefinitionLink[] | undefined | null>;
}

/**
 * Location representing a definition.
 */
export interface Location {
  uri: Uri;
  range: Range;
}

/**
 * Definition type.
 */
export type Definition = Location | Location[];

/**
 * Definition link with origin span.
 */
export interface DefinitionLink {
  originSelectionRange?: Range;
  targetUri: Uri;
  targetRange: Range;
  targetSelectionRange?: Range;
}

/**
 * Type definition provider.
 */
export interface TypeDefinitionProvider {
  provideTypeDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Definition | DefinitionLink[] | undefined | null | Promise<Definition | DefinitionLink[] | undefined | null>;
}

/**
 * Implementation provider.
 */
export interface ImplementationProvider {
  provideImplementation(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Definition | DefinitionLink[] | undefined | null | Promise<Definition | DefinitionLink[] | undefined | null>;
}

/**
 * Reference context.
 */
export interface ReferenceContext {
  readonly includeDeclaration: boolean;
}

/**
 * Reference provider.
 */
export interface ReferenceProvider {
  provideReferences(
    document: TextDocument,
    position: Position,
    context: ReferenceContext,
    token: CancellationToken
  ): Location[] | undefined | null | Promise<Location[] | undefined | null>;
}

/**
 * Document highlight kind.
 */
export enum DocumentHighlightKind {
  Text = 0,
  Read = 1,
  Write = 2,
}

/**
 * Document highlight.
 */
export interface DocumentHighlight {
  range: Range;
  kind?: DocumentHighlightKind;
}

/**
 * Document highlight provider.
 */
export interface DocumentHighlightProvider {
  provideDocumentHighlights(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): DocumentHighlight[] | undefined | null | Promise<DocumentHighlight[] | undefined | null>;
}

/**
 * Symbol kind.
 */
export enum SymbolKind {
  File = 0,
  Module = 1,
  Namespace = 2,
  Package = 3,
  Class = 4,
  Method = 5,
  Property = 6,
  Field = 7,
  Constructor = 8,
  Enum = 9,
  Interface = 10,
  Function = 11,
  Variable = 12,
  Constant = 13,
  String = 14,
  Number = 15,
  Boolean = 16,
  Array = 17,
  Object = 18,
  Key = 19,
  Null = 20,
  EnumMember = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

/**
 * Symbol tag.
 */
export enum SymbolTag {
  Deprecated = 1,
}

/**
 * Symbol information.
 */
export interface SymbolInformation {
  name: string;
  kind: SymbolKind;
  tags?: SymbolTag[];
  containerName?: string;
  location: Location;
}

/**
 * Document symbol.
 */
export interface DocumentSymbol {
  name: string;
  detail: string;
  kind: SymbolKind;
  tags?: SymbolTag[];
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

/**
 * Document symbol provider.
 */
export interface DocumentSymbolProvider {
  provideDocumentSymbols(
    document: TextDocument,
    token: CancellationToken
  ): SymbolInformation[] | DocumentSymbol[] | undefined | null | Promise<SymbolInformation[] | DocumentSymbol[] | undefined | null>;
}

/**
 * Workspace symbol provider.
 */
export interface WorkspaceSymbolProvider<T extends SymbolInformation = SymbolInformation> {
  provideWorkspaceSymbols(
    query: string,
    token: CancellationToken
  ): T[] | undefined | null | Promise<T[] | undefined | null>;
  resolveWorkspaceSymbol?(
    symbol: T,
    token: CancellationToken
  ): T | undefined | null | Promise<T | undefined | null>;
}

/**
 * Code action kind.
 */
export class CodeActionKind {
  static readonly Empty = new CodeActionKind("");
  static readonly QuickFix = new CodeActionKind("quickfix");
  static readonly Refactor = new CodeActionKind("refactor");
  static readonly RefactorExtract = new CodeActionKind("refactor.extract");
  static readonly RefactorInline = new CodeActionKind("refactor.inline");
  static readonly RefactorRewrite = new CodeActionKind("refactor.rewrite");
  static readonly Source = new CodeActionKind("source");
  static readonly SourceOrganizeImports = new CodeActionKind("source.organizeImports");
  static readonly SourceFixAll = new CodeActionKind("source.fixAll");

  private constructor(readonly value: string) {}

  append(parts: string): CodeActionKind {
    return new CodeActionKind(this.value ? `${this.value}.${parts}` : parts);
  }

  intersects(other: CodeActionKind): boolean {
    return this.value === other.value || 
           this.value.startsWith(other.value + ".") ||
           other.value.startsWith(this.value + ".");
  }

  contains(other: CodeActionKind): boolean {
    return this.value === other.value || other.value.startsWith(this.value + ".");
  }
}

/**
 * Code action.
 */
export interface CodeAction {
  title: string;
  kind?: CodeActionKind;
  diagnostics?: Diagnostic[];
  isPreferred?: boolean;
  disabled?: { reason: string };
  edit?: WorkspaceEdit;
  command?: Command;
}

/**
 * Code action context.
 */
export interface CodeActionContext {
  readonly triggerKind: CodeActionTriggerKind;
  readonly diagnostics: readonly Diagnostic[];
  readonly only?: CodeActionKind;
}

/**
 * Code action trigger kind.
 */
export enum CodeActionTriggerKind {
  Invoke = 1,
  Automatic = 2,
}

/**
 * Code action provider.
 */
export interface CodeActionProvider<T extends CodeAction = CodeAction> {
  provideCodeActions(
    document: TextDocument,
    range: Range | Selection,
    context: CodeActionContext,
    token: CancellationToken
  ): (Command | T)[] | undefined | null | Promise<(Command | T)[] | undefined | null>;
  resolveCodeAction?(
    codeAction: T,
    token: CancellationToken
  ): T | undefined | null | Promise<T | undefined | null>;
}

/**
 * Code action provider metadata.
 */
export interface CodeActionProviderMetadata {
  readonly providedCodeActionKinds?: readonly CodeActionKind[];
  readonly documentation?: ReadonlyArray<{ readonly kind: CodeActionKind; readonly command: Command }>;
}

/**
 * Workspace edit.
 */
export interface WorkspaceEdit {
  readonly size: number;
  replace(uri: Uri, range: Range, newText: string, metadata?: WorkspaceEditEntryMetadata): void;
  insert(uri: Uri, position: Position, newText: string, metadata?: WorkspaceEditEntryMetadata): void;
  delete(uri: Uri, range: Range, metadata?: WorkspaceEditEntryMetadata): void;
  has(uri: Uri): boolean;
  set(uri: Uri, edits: readonly TextEdit[] | readonly [TextEdit, WorkspaceEditEntryMetadata][]): void;
  get(uri: Uri): TextEdit[];
  createFile(uri: Uri, options?: { overwrite?: boolean; ignoreIfExists?: boolean }, metadata?: WorkspaceEditEntryMetadata): void;
  deleteFile(uri: Uri, options?: { recursive?: boolean; ignoreIfNotExists?: boolean }, metadata?: WorkspaceEditEntryMetadata): void;
  renameFile(oldUri: Uri, newUri: Uri, options?: { overwrite?: boolean; ignoreIfExists?: boolean }, metadata?: WorkspaceEditEntryMetadata): void;
  entries(): [Uri, TextEdit[]][];
}

/**
 * Workspace edit entry metadata.
 */
export interface WorkspaceEditEntryMetadata {
  needsConfirmation: boolean;
  label: string;
  description?: string;
  iconPath?: Uri | ThemeIcon | { light: Uri; dark: Uri };
}

/**
 * Diagnostic severity.
 */
export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

/**
 * Diagnostic tag.
 */
export enum DiagnosticTag {
  Unnecessary = 1,
  Deprecated = 2,
}

/**
 * Diagnostic related information.
 */
export interface DiagnosticRelatedInformation {
  location: Location;
  message: string;
}

/**
 * Diagnostic.
 */
export interface Diagnostic {
  range: Range;
  message: string;
  severity: DiagnosticSeverity;
  source?: string;
  code?: string | number | { value: string | number; target: Uri };
  relatedInformation?: DiagnosticRelatedInformation[];
  tags?: DiagnosticTag[];
}

/**
 * Diagnostic collection.
 */
export interface DiagnosticCollection extends Disposable {
  readonly name: string;
  set(uri: Uri, diagnostics: readonly Diagnostic[] | undefined): void;
  set(entries: ReadonlyArray<[Uri, readonly Diagnostic[] | undefined]>): void;
  delete(uri: Uri): void;
  clear(): void;
  forEach(callback: (uri: Uri, diagnostics: readonly Diagnostic[], collection: DiagnosticCollection) => void, thisArg?: unknown): void;
  get(uri: Uri): readonly Diagnostic[] | undefined;
  has(uri: Uri): boolean;
}

/**
 * Formatting options.
 */
export interface FormattingOptions {
  tabSize: number;
  insertSpaces: boolean;
  [key: string]: boolean | number | string;
}

/**
 * Document formatting edit provider.
 */
export interface DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: TextDocument,
    options: FormattingOptions,
    token: CancellationToken
  ): TextEdit[] | undefined | null | Promise<TextEdit[] | undefined | null>;
}

/**
 * Document range formatting edit provider.
 */
export interface DocumentRangeFormattingEditProvider {
  provideDocumentRangeFormattingEdits(
    document: TextDocument,
    range: Range,
    options: FormattingOptions,
    token: CancellationToken
  ): TextEdit[] | undefined | null | Promise<TextEdit[] | undefined | null>;
  provideDocumentRangesFormattingEdits?(
    document: TextDocument,
    ranges: Range[],
    options: FormattingOptions,
    token: CancellationToken
  ): TextEdit[] | undefined | null | Promise<TextEdit[] | undefined | null>;
}

/**
 * On type formatting edit provider.
 */
export interface OnTypeFormattingEditProvider {
  provideOnTypeFormattingEdits(
    document: TextDocument,
    position: Position,
    ch: string,
    options: FormattingOptions,
    token: CancellationToken
  ): TextEdit[] | undefined | null | Promise<TextEdit[] | undefined | null>;
}

/**
 * Signature help context.
 */
export interface SignatureHelpContext {
  readonly triggerKind: SignatureHelpTriggerKind;
  readonly triggerCharacter?: string;
  readonly isRetrigger: boolean;
  readonly activeSignatureHelp?: SignatureHelp;
}

/**
 * Signature help trigger kind.
 */
export enum SignatureHelpTriggerKind {
  Invoke = 1,
  TriggerCharacter = 2,
  ContentChange = 3,
}

/**
 * Parameter information.
 */
export interface ParameterInformation {
  label: string | [number, number];
  documentation?: string | MarkdownString;
}

/**
 * Signature information.
 */
export interface SignatureInformation {
  label: string;
  documentation?: string | MarkdownString;
  parameters: ParameterInformation[];
  activeParameter?: number;
}

/**
 * Signature help.
 */
export interface SignatureHelp {
  signatures: SignatureInformation[];
  activeSignature: number;
  activeParameter: number;
}

/**
 * Signature help provider.
 */
export interface SignatureHelpProvider {
  provideSignatureHelp(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: SignatureHelpContext
  ): SignatureHelp | undefined | null | Promise<SignatureHelp | undefined | null>;
}

/**
 * Signature help provider metadata.
 */
export interface SignatureHelpProviderMetadata {
  readonly triggerCharacters: readonly string[];
  readonly retriggerCharacters: readonly string[];
}

/**
 * Rename provider.
 */
export interface RenameProvider {
  provideRenameEdits(
    document: TextDocument,
    position: Position,
    newName: string,
    token: CancellationToken
  ): WorkspaceEdit | undefined | null | Promise<WorkspaceEdit | undefined | null>;
  prepareRename?(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Range | { range: Range; placeholder: string } | undefined | null | Promise<Range | { range: Range; placeholder: string } | undefined | null>;
}

/**
 * Semantic tokens legend.
 */
export interface SemanticTokensLegend {
  readonly tokenTypes: string[];
  readonly tokenModifiers: string[];
}

/**
 * Semantic tokens builder.
 */
export interface SemanticTokensBuilder {
  push(line: number, char: number, length: number, tokenType: number, tokenModifiers?: number): void;
  push(range: Range, tokenType: string, tokenModifiers?: string[]): void;
  build(resultId?: string): SemanticTokens;
}

/**
 * Semantic tokens.
 */
export interface SemanticTokens {
  readonly resultId?: string;
  readonly data: Uint32Array;
}

/**
 * Semantic tokens edits.
 */
export interface SemanticTokensEdits {
  readonly resultId?: string;
  readonly edits: SemanticTokensEdit[];
}

/**
 * Semantic tokens edit.
 */
export interface SemanticTokensEdit {
  readonly start: number;
  readonly deleteCount: number;
  readonly data?: Uint32Array;
}

/**
 * Document semantic tokens provider.
 */
export interface DocumentSemanticTokensProvider {
  onDidChangeSemanticTokens?: Event<void>;
  provideDocumentSemanticTokens(
    document: TextDocument,
    token: CancellationToken
  ): SemanticTokens | undefined | null | Promise<SemanticTokens | undefined | null>;
  provideDocumentSemanticTokensEdits?(
    document: TextDocument,
    previousResultId: string,
    token: CancellationToken
  ): SemanticTokens | SemanticTokensEdits | undefined | null | Promise<SemanticTokens | SemanticTokensEdits | undefined | null>;
}

// ============================================================================
// Extension Host Messages
// ============================================================================

/**
 * Message types between main thread and worker.
 */
export enum ExtensionHostMessageType {
  // Worker lifecycle
  Initialize = "initialize",
  Ready = "ready",
  Shutdown = "shutdown",
  ShutdownComplete = "shutdownComplete",

  // Extension lifecycle
  ActivateExtension = "activateExtension",
  DeactivateExtension = "deactivateExtension",
  ExtensionActivated = "extensionActivated",
  ExtensionDeactivated = "extensionDeactivated",
  ExtensionError = "extensionError",

  // API calls (worker -> main)
  ApiRequest = "apiRequest",
  ApiResponse = "apiResponse",

  // Events (main -> worker)
  Event = "event",

  // Commands
  ExecuteCommand = "executeCommand",
  CommandResult = "commandResult",
  RegisterCommand = "registerCommand",
  UnregisterCommand = "unregisterCommand",

  // Configuration
  ConfigurationChanged = "configurationChanged",
  WorkspaceFoldersChanged = "workspaceFoldersChanged",

  // Documents
  DocumentOpened = "documentOpened",
  DocumentClosed = "documentClosed",
  DocumentChanged = "documentChanged",
  DocumentSaved = "documentSaved",

  // Language features
  ProvideCompletion = "provideCompletion",
  ProvideHover = "provideHover",
  ProvideDefinition = "provideDefinition",
  ProvideReferences = "provideReferences",
  ProvideDocumentSymbols = "provideDocumentSymbols",
  ProvideCodeActions = "provideCodeActions",
  ProvideFormatting = "provideFormatting",

  // Telemetry
  Telemetry = "telemetry",

  // Logging
  Log = "log",

  // Health check
  Ping = "ping",
  Pong = "pong",
}

/**
 * Base message structure.
 */
export interface ExtensionHostMessage {
  type: ExtensionHostMessageType;
  requestId?: string;
  payload?: unknown;
}

/**
 * Initialize message payload.
 */
export interface InitializePayload {
  extensions: ExtensionDescription[];
  workspaceFolders: WorkspaceFolder[];
  configuration: Record<string, unknown>;
  logLevel: LogLevel;
  resourceLimits: ResourceLimits;
  hostVersion: string;
  platformInfo: PlatformInfo;
}

/**
 * Platform information.
 */
export interface PlatformInfo {
  os: "windows" | "macos" | "linux" | "unknown";
  arch: string;
  isWeb: boolean;
}

/**
 * Log level.
 */
export enum LogLevel {
  Trace = 0,
  Debug = 1,
  Info = 2,
  Warning = 3,
  Error = 4,
  Critical = 5,
  Off = 6,
}

/**
 * Resource limits for extension sandbox.
 */
export interface ResourceLimits {
  /** Maximum memory in MB */
  maxMemoryMB: number;
  /** CPU throttle percentage (100 = no throttle) */
  cpuThrottlePercent: number;
  /** Maximum single operation execution time in ms */
  maxExecutionTimeMs: number;
  /** Maximum number of concurrent operations */
  maxConcurrentOperations?: number;
  /** Maximum file size for reads in bytes */
  maxFileSizeBytes?: number;
}

/**
 * Extension description.
 */
export interface ExtensionDescription {
  /** Unique identifier (publisher.name or just name) */
  id: string;
  /** Display name */
  name: string;
  /** Version string (semver) */
  version: string;
  /** Absolute path to extension directory */
  path: string;
  /** Main entry point relative to path */
  main: string;
  /** Activation events */
  activationEvents: string[];
  /** Extension dependencies (IDs) */
  dependencies: string[];
  /** Extension kind */
  extensionKind: ExtensionKind[];
  /** Extension capabilities */
  capabilities?: ExtensionCapabilities;
  /** Whether extension is built-in */
  isBuiltin?: boolean;
  /** Whether extension is under development */
  isUnderDevelopment?: boolean;
}

/**
 * Extension capabilities.
 */
export interface ExtensionCapabilities {
  /** Virtual workspaces support */
  virtualWorkspaces?: boolean | { supported: boolean; description?: string };
  /** Untrusted workspaces support */
  untrustedWorkspaces?: { supported: boolean | "limited"; description?: string; restrictedConfigurations?: string[] };
}

/**
 * Extension kind.
 */
export enum ExtensionKind {
  UI = 1,
  Workspace = 2,
}

/**
 * API request payload.
 */
export interface ApiRequestPayload {
  namespace: string;
  method: string;
  args: unknown[];
  extensionId: string;
}

/**
 * API response payload.
 */
export interface ApiResponsePayload {
  result?: unknown;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Event payload.
 */
export interface EventPayload {
  eventName: string;
  data: unknown;
}

/**
 * Extension activated payload.
 */
export interface ExtensionActivatedPayload {
  extensionId: string;
  activationTime: number;
  exports?: unknown;
}

/**
 * Extension error payload.
 */
export interface ExtensionErrorPayload {
  extensionId: string;
  error: string;
  stack?: string;
  phase: "activation" | "runtime" | "deactivation";
  recoverable?: boolean;
}

// ============================================================================
// Extension State Types
// ============================================================================

/**
 * Extension runtime status.
 */
export enum ExtensionStatus {
  Inactive = "inactive",
  Activating = "activating",
  Active = "active",
  Deactivating = "deactivating",
  Error = "error",
  Crashed = "crashed",
}

/**
 * Extension runtime state.
 */
export interface ExtensionRuntimeState {
  id: string;
  status: ExtensionStatus;
  activationTime?: number;
  error?: string;
  memoryUsage?: number;
  cpuUsage?: number;
  lastActivity?: number;
  exports?: unknown;
}

/**
 * Extension host state.
 */
export interface ExtensionHostState {
  ready: boolean;
  extensions: Map<string, ExtensionRuntimeState>;
  pendingRequests: Map<string, PendingRequest>;
}

/**
 * Pending API request.
 */
export interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  extensionId: string;
  method: string;
  timestamp: number;
}

// ============================================================================
// File System Types
// ============================================================================

/**
 * File type.
 */
export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

/**
 * File stat.
 */
export interface FileStat {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;
  permissions?: FilePermission;
}

/**
 * File permission.
 */
export enum FilePermission {
  Readonly = 1,
}

/**
 * File system watcher.
 */
export interface FileSystemWatcher extends Disposable {
  readonly ignoreCreateEvents: boolean;
  readonly ignoreChangeEvents: boolean;
  readonly ignoreDeleteEvents: boolean;
  readonly onDidCreate: Event<Uri>;
  readonly onDidChange: Event<Uri>;
  readonly onDidDelete: Event<Uri>;
}
