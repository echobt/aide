/**
 * Extension API Surface
 *
 * Defines the API exposed to extensions running in the sandbox.
 * This module creates the `cortex` global object available to extensions.
 */

import {
  Disposable,
  DisposableStore,
  EventEmitter,
  Event,
  createDisposable,
  Uri,
  createUri,
  Position,
  createPosition,
  Range,
  createRange,
  Selection,
  createSelection,
  TextDocument,
  TextEdit as TypesTextEdit,
  WorkspaceFolder,
  WorkspaceConfiguration,
  ConfigurationTarget,
  OutputChannel,
  QuickPickItem,
  QuickPickOptions,
  InputBoxOptions,
  MessageItem,
  MessageOptions,
  ProgressLocation,
  ProgressOptions,
  Progress,
  CancellationToken,
  CancellationTokenSource,
  DocumentSelector,
  CompletionItemProvider,
  CompletionItemKind,
  CompletionTriggerKind,
  CompletionItem,
  HoverProvider,
  DefinitionProvider,
  TypeDefinitionProvider,
  ImplementationProvider,
  ReferenceProvider,
  ReferenceContext,
  DocumentHighlightProvider,
  DocumentSymbolProvider,
  SymbolKind,
  WorkspaceSymbolProvider,
  CodeActionProvider,
  CodeActionKind,
  CodeActionContext,
  CodeActionProviderMetadata,
  DocumentFormattingEditProvider,
  DocumentRangeFormattingEditProvider,
  OnTypeFormattingEditProvider,
  FormattingOptions,
  SignatureHelpProvider,
  SignatureHelp,
  SignatureHelpProviderMetadata,
  RenameProvider,
  DocumentSemanticTokensProvider,
  SemanticTokensLegend,
  DiagnosticCollection,
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  Location,
  MarkdownString,
  createMarkdownString,
  SnippetString,
  createSnippetString,
  EndOfLine,
  TextDocumentChangeReason,
  LogLevel,
  StatusBarItem,
  StatusBarAlignment,
  ThemeColor,
  ViewColumn,
  Command,
  WorkspaceEdit as TypesWorkspaceEdit,
  FileSystemWatcher,
  DocumentHighlightKind,
  CodeActionTriggerKind,
} from "./types";

// Import API creators from separate modules
import { createDebugApi, DebugConfigurationProviderTriggerKind, DebugConsoleMode } from "./api/debug";
import type { DebugApi } from "./api/debug";

import { createTasksApi, TaskScope } from "./api/tasks";
import type { TasksApi } from "./api/tasks";

import { createScmApi } from "./api/scm";
import type { ScmApi } from "./api/scm";

import { createTestsApi, TestRunProfileKind } from "./api/tests";
import type { TestsApi } from "./api/tests";

import { createAuthenticationApi } from "./api/authentication";
import type { AuthenticationApi } from "./api/authentication";

import { createEnvApi, createDefaultEnvConfig } from "./api/env";
import type { EnvApi, EnvApiConfig } from "./api/env";

import { createCommentsApi, CommentThreadCollapsibleState, CommentThreadState, CommentMode } from "./api/comments";
import type { CommentsApi } from "./api/comments";

import { createNotebooksApi, NotebookCellKind, NotebookCellExecutionState, NotebookEditorRevealType } from "./api/notebooks";
import type { NotebooksApi } from "./api/notebooks";

import { createL10nApi, createDefaultL10nConfig } from "./api/l10n";
import type { L10nApi, L10nConfig } from "./api/l10n";

// ============================================================================
// API Bridge Interface
// ============================================================================

/**
 * Bridge for communicating with the main thread.
 * Implemented by the worker to handle actual IPC.
 */
export interface ExtensionApiBridge {
  /**
   * Call a method on the main thread API.
   */
  callMainThread<T>(
    extensionId: string,
    namespace: string,
    method: string,
    args: unknown[]
  ): Promise<T>;

  /**
   * Subscribe to an event from the main thread.
   */
  subscribeEvent(
    eventName: string,
    listener: (data: unknown) => void
  ): Disposable;

  /**
   * Log from an extension.
   */
  log(extensionId: string, level: LogLevel, message: string, ...args: unknown[]): void;
}

// ============================================================================
// Commands API
// ============================================================================

export interface CommandsApi {
  /**
   * Register a command that can be invoked via command palette or programmatically.
   */
  registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable;

  /**
   * Register a text editor command.
   */
  registerTextEditorCommand(
    id: string,
    handler: (editor: unknown, edit: unknown, ...args: unknown[]) => void
  ): Disposable;

  /**
   * Execute a command by ID.
   */
  executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T>;

  /**
   * Get all available command IDs.
   */
  getCommands(filterInternal?: boolean): Promise<string[]>;
}

/**
 * Create the commands API.
 */
export function createCommandsApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): CommandsApi {
  const localCommands = new Map<string, (...args: unknown[]) => unknown>();

  return {
    registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable {
      const fullId = id.startsWith(`${extensionId}.`) ? id : `${extensionId}.${id}`;
      localCommands.set(fullId, handler);

      // Register with main thread
      bridge.callMainThread(extensionId, "commands", "register", [fullId]);

      const disposable = createDisposable(() => {
        localCommands.delete(fullId);
        bridge.callMainThread(extensionId, "commands", "unregister", [fullId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerTextEditorCommand(
      id: string,
      handler: (editor: unknown, edit: unknown, ...args: unknown[]) => void
    ): Disposable {
      return this.registerCommand(id, async (...args: unknown[]) => {
        const editor = await bridge.callMainThread(extensionId, "window", "getActiveTextEditor", []);
        const edit = {}; // TextEditorEdit proxy would go here
        return handler(editor, edit, ...args);
      });
    },

    async executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T> {
      // Check local commands first
      const localHandler = localCommands.get(id);
      if (localHandler) {
        return localHandler(...args) as T;
      }
      // Delegate to main thread
      return bridge.callMainThread<T>(extensionId, "commands", "execute", [id, ...args]);
    },

    async getCommands(filterInternal = false): Promise<string[]> {
      const mainCommands = await bridge.callMainThread<string[]>(
        extensionId,
        "commands",
        "getAll",
        [filterInternal]
      );
      const localIds = Array.from(localCommands.keys());
      return [...new Set([...mainCommands, ...localIds])];
    },
  };
}

// ============================================================================
// Workspace API
// ============================================================================

export interface WorkspaceApi {
  /**
   * Current workspace folders.
   */
  readonly workspaceFolders: readonly WorkspaceFolder[] | undefined;

  /**
   * Name of the workspace.
   */
  readonly name: string | undefined;

  /**
   * Workspace file URI.
   */
  readonly workspaceFile: Uri | undefined;

  /**
   * Event fired when workspace folders change.
   */
  readonly onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;

  /**
   * Event fired when a text document is opened.
   */
  readonly onDidOpenTextDocument: Event<TextDocument>;

  /**
   * Event fired when a text document is closed.
   */
  readonly onDidCloseTextDocument: Event<TextDocument>;

  /**
   * Event fired when a text document changes.
   */
  readonly onDidChangeTextDocument: Event<TextDocumentChangeEvent>;

  /**
   * Event fired when a text document is saved.
   */
  readonly onDidSaveTextDocument: Event<TextDocument>;

  /**
   * Open a text document.
   */
  openTextDocument(uri: Uri | string): Promise<TextDocument>;

  /**
   * Get configuration.
   */
  getConfiguration(section?: string, resource?: Uri): WorkspaceConfiguration;

  /**
   * Find files in workspace.
   */
  findFiles(
    include: string,
    exclude?: string,
    maxResults?: number,
    token?: CancellationToken
  ): Promise<Uri[]>;

  /**
   * Save all dirty files.
   */
  saveAll(includeUntitled?: boolean): Promise<boolean>;

  /**
   * Apply a workspace edit.
   */
  applyEdit(edit: TypesWorkspaceEdit): Promise<boolean>;

  /**
   * Create a file system watcher.
   */
  createFileSystemWatcher(
    globPattern: string,
    ignoreCreateEvents?: boolean,
    ignoreChangeEvents?: boolean,
    ignoreDeleteEvents?: boolean
  ): FileSystemWatcher;

  /**
   * Get text document by URI.
   */
  getTextDocument(uri: Uri): TextDocument | undefined;

  /**
   * All open text documents.
   */
  readonly textDocuments: readonly TextDocument[];
}

export interface WorkspaceFoldersChangeEvent {
  readonly added: readonly WorkspaceFolder[];
  readonly removed: readonly WorkspaceFolder[];
}

export interface TextDocumentChangeEvent {
  readonly document: TextDocument;
  readonly contentChanges: readonly TextDocumentContentChangeEvent[];
  readonly reason: TextDocumentChangeReason | undefined;
}

export interface TextDocumentContentChangeEvent {
  readonly range: Range;
  readonly rangeOffset: number;
  readonly rangeLength: number;
  readonly text: string;
}

// WorkspaceEdit and TextEdit are imported from types.ts
export type TextEdit = TypesTextEdit;
export type WorkspaceEdit = TypesWorkspaceEdit;

/**
 * Create the workspace API.
 */
export function createWorkspaceApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore,
  initialFolders: WorkspaceFolder[]
): WorkspaceApi {
  let workspaceFolders: WorkspaceFolder[] = [...initialFolders];

  const onDidChangeWorkspaceFoldersEmitter = new EventEmitter<WorkspaceFoldersChangeEvent>();
  const onDidOpenTextDocumentEmitter = new EventEmitter<TextDocument>();
  const onDidCloseTextDocumentEmitter = new EventEmitter<TextDocument>();
  const onDidChangeTextDocumentEmitter = new EventEmitter<TextDocumentChangeEvent>();
  const onDidSaveTextDocumentEmitter = new EventEmitter<TextDocument>();

  disposables.add(onDidChangeWorkspaceFoldersEmitter);
  disposables.add(onDidOpenTextDocumentEmitter);
  disposables.add(onDidCloseTextDocumentEmitter);
  disposables.add(onDidChangeTextDocumentEmitter);
  disposables.add(onDidSaveTextDocumentEmitter);

  // Subscribe to main thread events
  disposables.add(
    bridge.subscribeEvent("workspace.foldersChanged", (data) => {
      const event = data as WorkspaceFoldersChangeEvent;
      workspaceFolders = workspaceFolders
        .filter((f) => !event.removed.some((r) => r.uri.fsPath === f.uri.fsPath))
        .concat(event.added as WorkspaceFolder[]);
      onDidChangeWorkspaceFoldersEmitter.fire(event);
    })
  );

  disposables.add(
    bridge.subscribeEvent("workspace.documentOpened", (data) => {
      onDidOpenTextDocumentEmitter.fire(data as TextDocument);
    })
  );

  disposables.add(
    bridge.subscribeEvent("workspace.documentClosed", (data) => {
      onDidCloseTextDocumentEmitter.fire(data as TextDocument);
    })
  );

  disposables.add(
    bridge.subscribeEvent("workspace.documentChanged", (data) => {
      onDidChangeTextDocumentEmitter.fire(data as TextDocumentChangeEvent);
    })
  );

  disposables.add(
    bridge.subscribeEvent("workspace.documentSaved", (data) => {
      onDidSaveTextDocumentEmitter.fire(data as TextDocument);
    })
  );

  const configurationCache = new Map<string, WorkspaceConfiguration>();

  return {
    get workspaceFolders(): readonly WorkspaceFolder[] | undefined {
      return workspaceFolders.length > 0 ? workspaceFolders : undefined;
    },

    get name(): string | undefined {
      if (workspaceFolders.length === 0) return undefined;
      if (workspaceFolders.length === 1) return workspaceFolders[0].name;
      return "Multi-root Workspace";
    },

    get workspaceFile(): Uri | undefined {
      // Would be set from initialization if using a .code-workspace file
      return undefined;
    },

    onDidChangeWorkspaceFolders: onDidChangeWorkspaceFoldersEmitter.event,
    onDidOpenTextDocument: onDidOpenTextDocumentEmitter.event,
    onDidCloseTextDocument: onDidCloseTextDocumentEmitter.event,
    onDidChangeTextDocument: onDidChangeTextDocumentEmitter.event,
    onDidSaveTextDocument: onDidSaveTextDocumentEmitter.event,

    async openTextDocument(uriOrPath: Uri | string): Promise<TextDocument> {
      const uri = typeof uriOrPath === "string" ? createUri(uriOrPath) : uriOrPath;
      return bridge.callMainThread<TextDocument>(
        extensionId,
        "workspace",
        "openTextDocument",
        [uri]
      );
    },

    getConfiguration(section?: string, resource?: Uri): WorkspaceConfiguration {
      const cacheKey = `${section ?? ""}:${resource?.fsPath ?? ""}`;
      
      if (!configurationCache.has(cacheKey)) {
        const config = createWorkspaceConfiguration(extensionId, bridge, section, resource);
        configurationCache.set(cacheKey, config);
      }
      
      return configurationCache.get(cacheKey)!;
    },

    async findFiles(
      include: string,
      exclude?: string,
      maxResults?: number,
      _token?: CancellationToken
    ): Promise<Uri[]> {
      const paths = await bridge.callMainThread<string[]>(
        extensionId,
        "workspace",
        "findFiles",
        [include, exclude, maxResults]
      );
      return paths.map(createUri);
    },

    async saveAll(includeUntitled = false): Promise<boolean> {
      return bridge.callMainThread<boolean>(
        extensionId,
        "workspace",
        "saveAll",
        [includeUntitled]
      );
    },

    async applyEdit(edit: TypesWorkspaceEdit): Promise<boolean> {
      return bridge.callMainThread<boolean>(
        extensionId,
        "workspace",
        "applyEdit",
        [edit.entries()]
      );
    },

    createFileSystemWatcher(
      globPattern: string,
      ignoreCreateEvents = false,
      ignoreChangeEvents = false,
      ignoreDeleteEvents = false
    ): FileSystemWatcher {
      const onDidCreateEmitter = new EventEmitter<Uri>();
      const onDidChangeEmitter = new EventEmitter<Uri>();
      const onDidDeleteEmitter = new EventEmitter<Uri>();

      const watcherId = crypto.randomUUID();

      // Register watcher with main thread
      bridge.callMainThread(extensionId, "workspace", "createFileSystemWatcher", [
        watcherId,
        globPattern,
        { ignoreCreateEvents, ignoreChangeEvents, ignoreDeleteEvents },
      ]);

      // Subscribe to watcher events
      const createSub = bridge.subscribeEvent(`watcher.${watcherId}.create`, (data) => {
        onDidCreateEmitter.fire(createUri(data as string));
      });

      const changeSub = bridge.subscribeEvent(`watcher.${watcherId}.change`, (data) => {
        onDidChangeEmitter.fire(createUri(data as string));
      });

      const deleteSub = bridge.subscribeEvent(`watcher.${watcherId}.delete`, (data) => {
        onDidDeleteEmitter.fire(createUri(data as string));
      });

      const watcher = {
        ignoreCreateEvents: ignoreCreateEvents,
        ignoreChangeEvents: ignoreChangeEvents,
        ignoreDeleteEvents: ignoreDeleteEvents,
        onDidCreate: onDidCreateEmitter.event,
        onDidChange: onDidChangeEmitter.event,
        onDidDelete: onDidDeleteEmitter.event,
        dispose() {
          createSub.dispose();
          changeSub.dispose();
          deleteSub.dispose();
          onDidCreateEmitter.dispose();
          onDidChangeEmitter.dispose();
          onDidDeleteEmitter.dispose();
          bridge.callMainThread(extensionId, "workspace", "disposeFileSystemWatcher", [watcherId]);
        },
      };

      disposables.add(watcher);
      return watcher;
    },

    getTextDocument(_uri: Uri): TextDocument | undefined {
      // This is synchronous - returns from cache, or undefined
      // Real implementation would maintain document cache
      return undefined;
    },

    get textDocuments(): readonly TextDocument[] {
      // Would be maintained by document open/close events
      return [];
    },
  };
}

function createWorkspaceConfiguration(
  extensionId: string,
  bridge: ExtensionApiBridge,
  section?: string,
  _resource?: Uri
): WorkspaceConfiguration {
  // Configuration would be cached and updated via events
  const cache: Record<string, unknown> = {};

  return {
    get<T>(key: string, defaultValue?: T): T | undefined {
      const fullKey = section ? `${section}.${key}` : key;
      const value = cache[fullKey];
      return (value !== undefined ? value : defaultValue) as T | undefined;
    },

    has(key: string): boolean {
      const fullKey = section ? `${section}.${key}` : key;
      return fullKey in cache;
    },

    inspect<T>(key: string) {
      const fullKey = section ? `${section}.${key}` : key;
      return {
        key: fullKey,
        defaultValue: undefined as T | undefined,
        globalValue: cache[fullKey] as T | undefined,
        workspaceValue: undefined as T | undefined,
        workspaceFolderValue: undefined as T | undefined,
      };
    },

    async update(
      key: string,
      value: unknown,
      configurationTarget?: ConfigurationTarget
    ): Promise<void> {
      const fullKey = section ? `${section}.${key}` : key;
      cache[fullKey] = value;
      await bridge.callMainThread(extensionId, "workspace", "updateConfiguration", [
        fullKey,
        value,
        configurationTarget,
      ]);
    },
  };
}

// ============================================================================
// Window API
// ============================================================================

export interface WindowApi {
  /**
   * Show an information message.
   */
  showInformationMessage(
    message: string,
    ...items: string[]
  ): Promise<string | undefined>;
  showInformationMessage(
    message: string,
    options: MessageOptions,
    ...items: MessageItem[]
  ): Promise<MessageItem | undefined>;

  /**
   * Show a warning message.
   */
  showWarningMessage(
    message: string,
    ...items: string[]
  ): Promise<string | undefined>;
  showWarningMessage(
    message: string,
    options: MessageOptions,
    ...items: MessageItem[]
  ): Promise<MessageItem | undefined>;

  /**
   * Show an error message.
   */
  showErrorMessage(
    message: string,
    ...items: string[]
  ): Promise<string | undefined>;
  showErrorMessage(
    message: string,
    options: MessageOptions,
    ...items: MessageItem[]
  ): Promise<MessageItem | undefined>;

  /**
   * Show a quick pick.
   */
  showQuickPick(
    items: string[] | Promise<string[]>,
    options?: QuickPickOptions
  ): Promise<string | undefined>;
  showQuickPick<T extends QuickPickItem>(
    items: T[] | Promise<T[]>,
    options?: QuickPickOptions
  ): Promise<T | undefined>;

  /**
   * Show an input box.
   */
  showInputBox(options?: InputBoxOptions): Promise<string | undefined>;

  /**
   * Create an output channel.
   */
  createOutputChannel(name: string, languageId?: string): OutputChannel;

  /**
   * Show progress.
   */
  withProgress<R>(
    options: ProgressOptions,
    task: (
      progress: Progress<{ message?: string; increment?: number }>,
      token: CancellationToken
    ) => Promise<R>
  ): Promise<R>;

  /**
   * Set status bar message.
   */
  setStatusBarMessage(text: string, hideAfterTimeout?: number): Disposable;

  /**
   * Active text editor.
   */
  readonly activeTextEditor: TextEditor | undefined;

  /**
   * Visible text editors.
   */
  readonly visibleTextEditors: readonly TextEditor[];

  /**
   * Event fired when active editor changes.
   */
  readonly onDidChangeActiveTextEditor: Event<TextEditor | undefined>;

  /**
   * Show a text document.
   */
  showTextDocument(
    document: TextDocument,
    column?: ViewColumn,
    preserveFocus?: boolean
  ): Promise<TextEditor>;

  /**
   * Create a status bar item.
   */
  createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
  createStatusBarItem(id: string, alignment?: StatusBarAlignment, priority?: number): StatusBarItem;

  /**
   * Create a terminal.
   */
  createTerminal(name?: string, shellPath?: string, shellArgs?: string[] | string): Terminal;
  createTerminal(options: TerminalOptions): Terminal;

  /**
   * The currently active terminal.
   */
  readonly activeTerminal: Terminal | undefined;

  /**
   * All open terminals.
   */
  readonly terminals: readonly Terminal[];

  /**
   * Event fired when the active terminal changes.
   */
  readonly onDidChangeActiveTerminal: Event<Terminal | undefined>;

  /**
   * Event fired when a terminal is opened.
   */
  readonly onDidOpenTerminal: Event<Terminal>;

  /**
   * Event fired when a terminal is closed.
   */
  readonly onDidCloseTerminal: Event<Terminal>;

  /**
   * Show an open dialog.
   */
  showOpenDialog(options?: OpenDialogOptions): Promise<Uri[] | undefined>;

  /**
   * Show a save dialog.
   */
  showSaveDialog(options?: SaveDialogOptions): Promise<Uri | undefined>;

  /**
   * Register a tree data provider.
   */
  registerTreeDataProvider<T>(viewId: string, treeDataProvider: TreeDataProvider<T>): Disposable;

  /**
   * Create a tree view.
   */
  createTreeView<T>(viewId: string, options: TreeViewOptions<T>): TreeView<T>;

  /**
   * Register a webview panel serializer.
   */
  registerWebviewPanelSerializer(viewType: string, serializer: WebviewPanelSerializer): Disposable;

  /**
   * Create a webview panel.
   */
  createWebviewPanel(
    viewType: string,
    title: string,
    showOptions: ViewColumn | { viewColumn: ViewColumn; preserveFocus?: boolean },
    options?: WebviewPanelOptions & WebviewOptions
  ): WebviewPanel;
}

/**
 * Terminal.
 */
export interface Terminal {
  readonly name: string;
  readonly processId: Promise<number | undefined>;
  readonly creationOptions: Readonly<TerminalOptions>;
  readonly exitStatus: TerminalExitStatus | undefined;
  readonly state: TerminalState;
  sendText(text: string, addNewLine?: boolean): void;
  show(preserveFocus?: boolean): void;
  hide(): void;
  dispose(): void;
}

/**
 * Terminal options.
 */
export interface TerminalOptions {
  name?: string;
  shellPath?: string;
  shellArgs?: string[] | string;
  cwd?: string | Uri;
  env?: { [key: string]: string | null | undefined };
  strictEnv?: boolean;
  hideFromUser?: boolean;
  message?: string;
  iconPath?: Uri | ThemeIcon | { light: Uri; dark: Uri };
  color?: ThemeColor;
  location?: TerminalLocation | TerminalEditorLocationOptions | TerminalSplitLocationOptions;
  isTransient?: boolean;
}

/**
 * Terminal exit status.
 */
export interface TerminalExitStatus {
  readonly code: number | undefined;
  readonly reason: TerminalExitReason;
}

/**
 * Terminal exit reason.
 */
export enum TerminalExitReason {
  Unknown = 0,
  Shutdown = 1,
  Process = 2,
  User = 3,
  Extension = 4,
}

/**
 * Terminal state.
 */
export interface TerminalState {
  readonly isInteractedWith: boolean;
}

/**
 * Terminal location.
 */
export enum TerminalLocation {
  Panel = 1,
  Editor = 2,
}

/**
 * Terminal editor location options.
 */
export interface TerminalEditorLocationOptions {
  viewColumn: ViewColumn;
  preserveFocus?: boolean;
}

/**
 * Terminal split location options.
 */
export interface TerminalSplitLocationOptions {
  parentTerminal: Terminal;
}

/**
 * Theme icon.
 */
export interface ThemeIcon {
  readonly id: string;
  readonly color?: ThemeColor;
}

/**
 * Open dialog options.
 */
export interface OpenDialogOptions {
  defaultUri?: Uri;
  openLabel?: string;
  canSelectFiles?: boolean;
  canSelectFolders?: boolean;
  canSelectMany?: boolean;
  filters?: { [name: string]: string[] };
  title?: string;
}

/**
 * Save dialog options.
 */
export interface SaveDialogOptions {
  defaultUri?: Uri;
  saveLabel?: string;
  filters?: { [name: string]: string[] };
  title?: string;
}

/**
 * Tree data provider.
 */
export interface TreeDataProvider<T> {
  onDidChangeTreeData?: Event<T | undefined | null | void>;
  getTreeItem(element: T): TreeItem | Promise<TreeItem>;
  getChildren(element?: T): T[] | undefined | null | Promise<T[] | undefined | null>;
  getParent?(element: T): T | undefined | null | Promise<T | undefined | null>;
  resolveTreeItem?(item: TreeItem, element: T, token: CancellationToken): TreeItem | undefined | null | Promise<TreeItem | undefined | null>;
}

/**
 * Tree item.
 */
export interface TreeItem {
  label?: string | TreeItemLabel;
  id?: string;
  iconPath?: string | Uri | ThemeIcon | { light: string | Uri; dark: string | Uri };
  description?: string | boolean;
  tooltip?: string | MarkdownString | undefined;
  command?: Command;
  collapsibleState?: TreeItemCollapsibleState;
  contextValue?: string;
  accessibilityInformation?: { label: string; role?: string };
  checkboxState?: TreeItemCheckboxState | { state: TreeItemCheckboxState; tooltip?: string; accessibilityInformation?: { label: string } };
}

/**
 * Tree item label.
 */
export interface TreeItemLabel {
  label: string;
  highlights?: [number, number][];
}

/**
 * Tree item collapsible state.
 */
export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

/**
 * Tree item checkbox state.
 */
export enum TreeItemCheckboxState {
  Unchecked = 0,
  Checked = 1,
}

/**
 * Tree view options.
 */
export interface TreeViewOptions<T> {
  treeDataProvider: TreeDataProvider<T>;
  showCollapseAll?: boolean;
  canSelectMany?: boolean;
  dragAndDropController?: TreeDragAndDropController<T>;
  manageCheckboxStateManually?: boolean;
}

/**
 * Tree drag and drop controller.
 */
export interface TreeDragAndDropController<T> {
  readonly dropMimeTypes: readonly string[];
  readonly dragMimeTypes: readonly string[];
  handleDrag?(source: readonly T[], dataTransfer: DataTransfer, token: CancellationToken): void | Promise<void>;
  handleDrop?(target: T | undefined, dataTransfer: DataTransfer, token: CancellationToken): void | Promise<void>;
}

/**
 * Data transfer.
 */
export interface DataTransfer {
  get(mimeType: string): DataTransferItem | undefined;
  set(mimeType: string, value: DataTransferItem): void;
  forEach(callbackfn: (value: DataTransferItem, key: string) => void): void;
}

/**
 * Data transfer item.
 */
export interface DataTransferItem {
  asString(): Promise<string>;
  asFile(): DataTransferFile | undefined;
  value: unknown;
}

/**
 * Data transfer file.
 */
export interface DataTransferFile {
  readonly name: string;
  readonly uri?: Uri;
  data(): Promise<Uint8Array>;
}

/**
 * Tree view.
 */
export interface TreeView<T> extends Disposable {
  readonly onDidExpandElement: Event<TreeViewExpansionEvent<T>>;
  readonly onDidCollapseElement: Event<TreeViewExpansionEvent<T>>;
  readonly onDidChangeSelection: Event<TreeViewSelectionChangeEvent<T>>;
  readonly onDidChangeVisibility: Event<TreeViewVisibilityChangeEvent>;
  readonly onDidChangeCheckboxState: Event<TreeCheckboxChangeEvent<T>>;
  readonly visible: boolean;
  message?: string;
  title?: string;
  description?: string;
  badge?: ViewBadge | undefined;
  selection: readonly T[];
  reveal(element: T, options?: { select?: boolean; focus?: boolean; expand?: boolean | number }): Promise<void>;
}

/**
 * View badge.
 */
export interface ViewBadge {
  tooltip: string;
  value: number;
}

/**
 * Tree view expansion event.
 */
export interface TreeViewExpansionEvent<T> {
  readonly element: T;
}

/**
 * Tree view selection change event.
 */
export interface TreeViewSelectionChangeEvent<T> {
  readonly selection: readonly T[];
}

/**
 * Tree view visibility change event.
 */
export interface TreeViewVisibilityChangeEvent {
  readonly visible: boolean;
}

/**
 * Tree checkbox change event.
 */
export interface TreeCheckboxChangeEvent<T> {
  readonly items: ReadonlyArray<[T, TreeItemCheckboxState]>;
}

/**
 * Webview panel serializer.
 */
export interface WebviewPanelSerializer<T = unknown> {
  deserializeWebviewPanel(webviewPanel: WebviewPanel, state: T): Promise<void>;
}

/**
 * Webview panel.
 */
export interface WebviewPanel {
  readonly viewType: string;
  title: string;
  iconPath?: Uri | { light: Uri; dark: Uri };
  readonly webview: Webview;
  readonly options: WebviewPanelOptions;
  readonly viewColumn: ViewColumn | undefined;
  readonly active: boolean;
  readonly visible: boolean;
  readonly onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent>;
  readonly onDidDispose: Event<void>;
  reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void;
  dispose(): void;
}

/**
 * Webview panel options.
 */
export interface WebviewPanelOptions {
  readonly enableFindWidget?: boolean;
  readonly retainContextWhenHidden?: boolean;
}

/**
 * Webview options.
 */
export interface WebviewOptions {
  readonly enableScripts?: boolean;
  readonly enableForms?: boolean;
  readonly enableCommandUris?: boolean | readonly string[];
  readonly localResourceRoots?: readonly Uri[];
  readonly portMapping?: readonly WebviewPortMapping[];
}

/**
 * Webview port mapping.
 */
export interface WebviewPortMapping {
  readonly webviewPort: number;
  readonly extensionHostPort: number;
}

/**
 * Webview.
 */
export interface Webview {
  options: WebviewOptions;
  html: string;
  readonly onDidReceiveMessage: Event<unknown>;
  postMessage(message: unknown): Promise<boolean>;
  asWebviewUri(localResource: Uri): Uri;
  readonly cspSource: string;
}

/**
 * Webview panel on did change view state event.
 */
export interface WebviewPanelOnDidChangeViewStateEvent {
  readonly webviewPanel: WebviewPanel;
}

export interface TextEditor {
  readonly document: TextDocument;
  selection: Selection;
  selections: Selection[];
  readonly visibleRanges: Range[];
  options: TextEditorOptions;
  readonly viewColumn: ViewColumn | undefined;
  edit(
    callback: (editBuilder: TextEditorEdit) => void,
    options?: { undoStopBefore: boolean; undoStopAfter: boolean }
  ): Promise<boolean>;
  insertSnippet(
    snippet: SnippetString,
    location?: Position | Range | readonly Position[] | readonly Range[],
    options?: { undoStopBefore: boolean; undoStopAfter: boolean }
  ): Promise<boolean>;
  setDecorations(
    decorationType: TextEditorDecorationType,
    rangesOrOptions: Range[] | DecorationOptions[]
  ): void;
  revealRange(range: Range, revealType?: TextEditorRevealType): void;
}

export interface TextEditorOptions {
  tabSize?: number | string;
  insertSpaces?: boolean | string;
  cursorStyle?: TextEditorCursorStyle;
  lineNumbers?: TextEditorLineNumbersStyle;
}

export interface TextEditorEdit {
  replace(location: Position | Range | Selection, value: string): void;
  insert(location: Position, value: string): void;
  delete(location: Range | Selection): void;
  setEndOfLine(endOfLine: EndOfLine): void;
}

export interface TextEditorDecorationType extends Disposable {
  readonly key: string;
}

export interface DecorationOptions {
  range: Range;
  hoverMessage?: MarkdownString | MarkdownString[];
  renderOptions?: DecorationRenderOptions;
}

export interface DecorationRenderOptions {
  backgroundColor?: string;
  border?: string;
  borderColor?: string;
  color?: string;
  fontStyle?: string;
  fontWeight?: string;
  textDecoration?: string;
  outline?: string;
  outlineColor?: string;
}

export enum TextEditorCursorStyle {
  Line = 1,
  Block = 2,
  Underline = 3,
  LineThin = 4,
  BlockOutline = 5,
  UnderlineThin = 6,
}

export enum TextEditorLineNumbersStyle {
  Off = 0,
  On = 1,
  Relative = 2,
}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
  AtTop = 3,
}

// ViewColumn is imported from types.ts

/**
 * Create the window API.
 */
export function createWindowApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): WindowApi {
  const outputChannels = new Map<string, OutputChannel>();
  const onDidChangeActiveTextEditorEmitter = new EventEmitter<TextEditor | undefined>();

  // Terminal tracking state
  const terminalMap = new Map<string, Terminal>();
  let activeTerminalId: string | undefined;
  const onDidChangeActiveTerminalEmitter = new EventEmitter<Terminal | undefined>();
  const onDidOpenTerminalEmitter = new EventEmitter<Terminal>();
  const onDidCloseTerminalEmitter = new EventEmitter<Terminal>();

  disposables.add(onDidChangeActiveTextEditorEmitter);
  disposables.add(onDidChangeActiveTerminalEmitter);
  disposables.add(onDidOpenTerminalEmitter);
  disposables.add(onDidCloseTerminalEmitter);

  disposables.add(
    bridge.subscribeEvent("window.activeEditorChanged", (data) => {
      onDidChangeActiveTextEditorEmitter.fire(data as TextEditor | undefined);
    })
  );

  // Subscribe to terminal events from main thread
  disposables.add(
    bridge.subscribeEvent("terminal.opened", (rawData: unknown) => {
      const data = rawData as { id: string; name: string };
      const terminal = terminalMap.get(data.id);
      if (terminal) {
        onDidOpenTerminalEmitter.fire(terminal);
      }
    })
  );

  disposables.add(
    bridge.subscribeEvent("terminal.closed", (rawData: unknown) => {
      const data = rawData as { id: string; exitCode?: number };
      const terminal = terminalMap.get(data.id);
      if (terminal) {
        (terminal as { exitStatus: { code: number } | undefined }).exitStatus = 
          data.exitCode !== undefined ? { code: data.exitCode } : undefined;
        onDidCloseTerminalEmitter.fire(terminal);
        terminalMap.delete(data.id);
        if (activeTerminalId === data.id) {
          activeTerminalId = undefined;
          onDidChangeActiveTerminalEmitter.fire(undefined);
        }
      }
    })
  );

  disposables.add(
    bridge.subscribeEvent("terminal.activeChanged", (rawData: unknown) => {
      const data = rawData as { id: string | null };
      activeTerminalId = data.id ?? undefined;
      const terminal = data.id ? terminalMap.get(data.id) : undefined;
      onDidChangeActiveTerminalEmitter.fire(terminal);
    })
  );

  const api: WindowApi = {
    showInformationMessage: (async (
      message: string,
      optionsOrItem?: MessageOptions | string,
      ...items: (MessageItem | string)[]
    ): Promise<string | MessageItem | undefined> => {
      const isOptions = typeof optionsOrItem === "object" && "modal" in optionsOrItem;
      const options = isOptions ? optionsOrItem : undefined;
      const allItems = isOptions
        ? items
        : optionsOrItem
        ? [optionsOrItem, ...items]
        : items;

      return bridge.callMainThread(extensionId, "window", "showInformationMessage", [
        message,
        options,
        allItems,
      ]);
    }) as WindowApi["showInformationMessage"],

    showWarningMessage: (async (
      message: string,
      optionsOrItem?: MessageOptions | string,
      ...items: (MessageItem | string)[]
    ): Promise<string | MessageItem | undefined> => {
      const isOptions = typeof optionsOrItem === "object" && "modal" in optionsOrItem;
      const options = isOptions ? optionsOrItem : undefined;
      const allItems = isOptions
        ? items
        : optionsOrItem
        ? [optionsOrItem, ...items]
        : items;

      return bridge.callMainThread(extensionId, "window", "showWarningMessage", [
        message,
        options,
        allItems,
      ]);
    }) as WindowApi["showWarningMessage"],

    showErrorMessage: (async (
      message: string,
      optionsOrItem?: MessageOptions | string,
      ...items: (MessageItem | string)[]
    ): Promise<string | MessageItem | undefined> => {
      const isOptions = typeof optionsOrItem === "object" && "modal" in optionsOrItem;
      const options = isOptions ? optionsOrItem : undefined;
      const allItems = isOptions
        ? items
        : optionsOrItem
        ? [optionsOrItem, ...items]
        : items;

      return bridge.callMainThread(extensionId, "window", "showErrorMessage", [
        message,
        options,
        allItems,
      ]);
    }) as WindowApi["showErrorMessage"],

    async showQuickPick<T extends QuickPickItem | string>(
      items: T[] | Promise<T[]>,
      options?: QuickPickOptions
    ): Promise<T | undefined> {
      const resolvedItems = await items;
      return bridge.callMainThread<T | undefined>(
        extensionId,
        "window",
        "showQuickPick",
        [resolvedItems, options]
      );
    },

    async showInputBox(options?: InputBoxOptions): Promise<string | undefined> {
      return bridge.callMainThread<string | undefined>(
        extensionId,
        "window",
        "showInputBox",
        [options]
      );
    },

    createOutputChannel(name: string, languageId?: string): OutputChannel {
      const existing = outputChannels.get(name);
      if (existing) return existing;

      let buffer = "";
      const channelId = crypto.randomUUID();

      const channel: OutputChannel = {
        name,
        append(value: string) {
          buffer += value;
          bridge.callMainThread(extensionId, "window", "outputChannelAppend", [
            channelId,
            name,
            value,
            languageId,
          ]);
        },
        appendLine(value: string) {
          this.append(value + "\n");
        },
        replace(value: string) {
          buffer = value;
          bridge.callMainThread(extensionId, "window", "outputChannelReplace", [
            channelId,
            value,
          ]);
        },
        clear() {
          buffer = "";
          bridge.callMainThread(extensionId, "window", "outputChannelClear", [channelId]);
        },
        show(preserveFocusOrColumn?: boolean | ViewColumn, preserveFocus?: boolean) {
          const actualPreserveFocus = typeof preserveFocusOrColumn === "boolean" 
            ? preserveFocusOrColumn 
            : preserveFocus ?? false;
          bridge.callMainThread(extensionId, "window", "outputChannelShow", [
            channelId,
            actualPreserveFocus,
          ]);
        },
        hide() {
          bridge.callMainThread(extensionId, "window", "outputChannelHide", [channelId]);
        },
        dispose() {
          outputChannels.delete(name);
          bridge.callMainThread(extensionId, "window", "outputChannelDispose", [channelId]);
        },
      };

      outputChannels.set(name, channel);
      disposables.add(channel);
      return channel;
    },

    async withProgress<R>(
      options: ProgressOptions,
      task: (
        progress: Progress<{ message?: string; increment?: number }>,
        token: CancellationToken
      ) => Promise<R>
    ): Promise<R> {
      const progressId = crypto.randomUUID();
      
      // Start progress on main thread
      await bridge.callMainThread(extensionId, "window", "startProgress", [
        progressId,
        options,
      ]);

      const progress: Progress<{ message?: string; increment?: number }> = {
        report(value) {
          bridge.callMainThread(extensionId, "window", "reportProgress", [
            progressId,
            value,
          ]);
        },
      };

      let cancelled = false;
      const cancellationEmitter = new EventEmitter<void>();
      const token: CancellationToken = {
        get isCancellationRequested() {
          return cancelled;
        },
        onCancellationRequested: cancellationEmitter.event,
      };

      // Subscribe to cancellation
      const cancelSub = bridge.subscribeEvent(`progress.${progressId}.cancel`, () => {
        cancelled = true;
        cancellationEmitter.fire();
      });

      try {
        return await task(progress, token);
      } finally {
        cancelSub.dispose();
        cancellationEmitter.dispose();
        await bridge.callMainThread(extensionId, "window", "endProgress", [progressId]);
      }
    },

    setStatusBarMessage(text: string, hideAfterTimeout?: number): Disposable {
      const messageId = crypto.randomUUID();
      bridge.callMainThread(extensionId, "window", "setStatusBarMessage", [
        messageId,
        text,
        hideAfterTimeout,
      ]);

      return createDisposable(() => {
        bridge.callMainThread(extensionId, "window", "clearStatusBarMessage", [messageId]);
      });
    },

    get activeTextEditor(): TextEditor | undefined {
      // Would be maintained via events
      return undefined;
    },

    get visibleTextEditors(): readonly TextEditor[] {
      return [];
    },

    onDidChangeActiveTextEditor: onDidChangeActiveTextEditorEmitter.event,

    async showTextDocument(
      document: TextDocument,
      columnOrOptions?: ViewColumn | { viewColumn?: ViewColumn; preserveFocus?: boolean },
      preserveFocus?: boolean
    ): Promise<TextEditor> {
      const options =
        typeof columnOrOptions === "number"
          ? { viewColumn: columnOrOptions, preserveFocus }
          : columnOrOptions ?? {};

      return bridge.callMainThread<TextEditor>(
        extensionId,
        "window",
        "showTextDocument",
        [document.uri, options]
      );
    },

    createStatusBarItem(
      idOrAlignment?: string | StatusBarAlignment,
      alignmentOrPriority?: StatusBarAlignment | number,
      priority?: number
    ): StatusBarItem {
      let id: string;
      let alignment: StatusBarAlignment;
      let itemPriority: number;

      if (typeof idOrAlignment === "string") {
        id = idOrAlignment;
        alignment = alignmentOrPriority as StatusBarAlignment ?? StatusBarAlignment.Left;
        itemPriority = priority ?? 0;
      } else {
        id = `${extensionId}.statusbar.${crypto.randomUUID()}`;
        alignment = idOrAlignment ?? StatusBarAlignment.Left;
        itemPriority = (alignmentOrPriority as number) ?? 0;
      }

      let text = "";
      let tooltip: string | MarkdownString | undefined;
      let color: string | ThemeColor | undefined;
      let backgroundColor: ThemeColor | undefined;
      let command: string | Command | undefined;
      let name: string | undefined;
      let isVisible = false;

      const statusBarItem: StatusBarItem = {
        get id() {
          return id;
        },
        alignment,
        priority: itemPriority,
        get name() {
          return name;
        },
        set name(value: string | undefined) {
          name = value;
          if (isVisible) {
            bridge.callMainThread(extensionId, "window", "updateStatusBarItem", [
              id,
              { name },
            ]);
          }
        },
        get text() {
          return text;
        },
        set text(value: string) {
          text = value;
          if (isVisible) {
            bridge.callMainThread(extensionId, "window", "updateStatusBarItem", [
              id,
              { text },
            ]);
          }
        },
        get tooltip() {
          return tooltip;
        },
        set tooltip(value: string | MarkdownString | undefined) {
          tooltip = value;
          if (isVisible) {
            bridge.callMainThread(extensionId, "window", "updateStatusBarItem", [
              id,
              { tooltip: typeof value === "string" ? value : value?.value },
            ]);
          }
        },
        get color() {
          return color;
        },
        set color(value: string | ThemeColor | undefined) {
          color = value;
          if (isVisible) {
            bridge.callMainThread(extensionId, "window", "updateStatusBarItem", [
              id,
              { color: typeof value === "string" ? value : value?.id },
            ]);
          }
        },
        get backgroundColor() {
          return backgroundColor;
        },
        set backgroundColor(value: ThemeColor | undefined) {
          backgroundColor = value;
          if (isVisible) {
            bridge.callMainThread(extensionId, "window", "updateStatusBarItem", [
              id,
              { backgroundColor: value?.id },
            ]);
          }
        },
        get command() {
          return command;
        },
        set command(value: string | Command | undefined) {
          command = value;
          if (isVisible) {
            bridge.callMainThread(extensionId, "window", "updateStatusBarItem", [
              id,
              { command: typeof value === "string" ? value : value?.command },
            ]);
          }
        },
        accessibilityInformation: undefined,
        show() {
          if (!isVisible) {
            isVisible = true;
            bridge.callMainThread(extensionId, "window", "createStatusBarItem", [
              id,
              {
                alignment,
                priority: itemPriority,
                text,
                tooltip: typeof tooltip === "string" ? tooltip : tooltip?.value,
                color: typeof color === "string" ? color : color?.id,
                backgroundColor: backgroundColor?.id,
                command: typeof command === "string" ? command : command?.command,
                name,
              },
            ]);
          }
        },
        hide() {
          if (isVisible) {
            isVisible = false;
            bridge.callMainThread(extensionId, "window", "hideStatusBarItem", [id]);
          }
        },
        dispose() {
          isVisible = false;
          bridge.callMainThread(extensionId, "window", "disposeStatusBarItem", [id]);
        },
      };

      disposables.add(statusBarItem);
      return statusBarItem;
    },

    createTerminal(
      nameOrOptions?: string | TerminalOptions,
      shellPath?: string,
      shellArgs?: string[] | string
    ): Terminal {
      const terminalId = crypto.randomUUID();
      let options: TerminalOptions;

      if (typeof nameOrOptions === "object") {
        options = nameOrOptions;
      } else {
        options = {
          name: nameOrOptions,
          shellPath,
          shellArgs,
        };
      }

      bridge.callMainThread(extensionId, "window", "createTerminal", [
        terminalId,
        options,
      ]);

      const terminal: Terminal = {
        name: options.name ?? "Terminal",
        processId: bridge.callMainThread<number | undefined>(
          extensionId,
          "window",
          "getTerminalProcessId",
          [terminalId]
        ),
        creationOptions: options,
        exitStatus: undefined,
        state: { isInteractedWith: false },
        sendText(text: string, addNewLine = true) {
          bridge.callMainThread(extensionId, "window", "terminalSendText", [
            terminalId,
            text,
            addNewLine,
          ]);
        },
        show(preserveFocus = false) {
          bridge.callMainThread(extensionId, "window", "terminalShow", [
            terminalId,
            preserveFocus,
          ]);
        },
        hide() {
          bridge.callMainThread(extensionId, "window", "terminalHide", [terminalId]);
        },
        dispose() {
          bridge.callMainThread(extensionId, "window", "terminalDispose", [terminalId]);
          terminalMap.delete(terminalId);
        },
      };

      // Track the terminal
      terminalMap.set(terminalId, terminal);
      
      return terminal;
    },

    get activeTerminal(): Terminal | undefined {
      return activeTerminalId ? terminalMap.get(activeTerminalId) : undefined;
    },

    get terminals(): readonly Terminal[] {
      return Array.from(terminalMap.values());
    },

    onDidChangeActiveTerminal: onDidChangeActiveTerminalEmitter.event,
    onDidOpenTerminal: onDidOpenTerminalEmitter.event,
    onDidCloseTerminal: onDidCloseTerminalEmitter.event,

    async showOpenDialog(options?: OpenDialogOptions): Promise<Uri[] | undefined> {
      const paths = await bridge.callMainThread<string[] | undefined>(
        extensionId,
        "window",
        "showOpenDialog",
        [options]
      );
      return paths?.map(createUri);
    },

    async showSaveDialog(options?: SaveDialogOptions): Promise<Uri | undefined> {
      const path = await bridge.callMainThread<string | undefined>(
        extensionId,
        "window",
        "showSaveDialog",
        [options]
      );
      return path ? createUri(path) : undefined;
    },

    registerTreeDataProvider<T>(
      viewId: string,
      treeDataProvider: TreeDataProvider<T>
    ): Disposable {
      const providerId = `${extensionId}.tree.${viewId}`;

      bridge.callMainThread(extensionId, "window", "registerTreeDataProvider", [
        providerId,
        viewId,
      ]);

      // Handle tree data requests
      const sub = bridge.subscribeEvent(
        `tree.${providerId}.getChildren`,
        async (data) => {
          const { requestId, element } = data as {
            requestId: string;
            element: T | undefined;
          };
          try {
            const children = await treeDataProvider.getChildren(element);
            bridge.callMainThread(extensionId, "window", "treeDataResponse", [
              requestId,
              children,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "window", "treeDataResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const itemSub = bridge.subscribeEvent(
        `tree.${providerId}.getTreeItem`,
        async (data) => {
          const { requestId, element } = data as {
            requestId: string;
            element: T;
          };
          try {
            const item = await treeDataProvider.getTreeItem(element);
            bridge.callMainThread(extensionId, "window", "treeItemResponse", [
              requestId,
              item,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "window", "treeItemResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        sub.dispose();
        itemSub.dispose();
        bridge.callMainThread(extensionId, "window", "unregisterTreeDataProvider", [
          providerId,
        ]);
      });

      disposables.add(disposable);
      return disposable;
    },

    createTreeView<T>(viewId: string, options: TreeViewOptions<T>): TreeView<T> {
      const disposable = this.registerTreeDataProvider(viewId, options.treeDataProvider);

      const onDidExpandElementEmitter = new EventEmitter<TreeViewExpansionEvent<T>>();
      const onDidCollapseElementEmitter = new EventEmitter<TreeViewExpansionEvent<T>>();
      const onDidChangeSelectionEmitter = new EventEmitter<TreeViewSelectionChangeEvent<T>>();
      const onDidChangeVisibilityEmitter = new EventEmitter<TreeViewVisibilityChangeEvent>();
      const onDidChangeCheckboxStateEmitter = new EventEmitter<TreeCheckboxChangeEvent<T>>();

      const treeView: TreeView<T> = {
        onDidExpandElement: onDidExpandElementEmitter.event,
        onDidCollapseElement: onDidCollapseElementEmitter.event,
        onDidChangeSelection: onDidChangeSelectionEmitter.event,
        onDidChangeVisibility: onDidChangeVisibilityEmitter.event,
        onDidChangeCheckboxState: onDidChangeCheckboxStateEmitter.event,
        visible: true,
        message: undefined,
        title: undefined,
        description: undefined,
        badge: undefined,
        selection: [],
        async reveal(element, revealOptions) {
          await bridge.callMainThread(extensionId, "window", "treeViewReveal", [
            viewId,
            element,
            revealOptions,
          ]);
        },
        dispose() {
          disposable.dispose();
          onDidExpandElementEmitter.dispose();
          onDidCollapseElementEmitter.dispose();
          onDidChangeSelectionEmitter.dispose();
          onDidChangeVisibilityEmitter.dispose();
          onDidChangeCheckboxStateEmitter.dispose();
        },
      };

      return treeView;
    },

    registerWebviewPanelSerializer(
      viewType: string,
      serializer: WebviewPanelSerializer
    ): Disposable {
      const serializerId = `${extensionId}.webview.${viewType}`;

      bridge.callMainThread(extensionId, "window", "registerWebviewPanelSerializer", [
        serializerId,
        viewType,
      ]);

      const sub = bridge.subscribeEvent(
        `webview.${serializerId}.deserialize`,
        async (data) => {
          const { requestId, panel, state } = data as {
            requestId: string;
            panel: WebviewPanel;
            state: unknown;
          };
          try {
            await serializer.deserializeWebviewPanel(panel, state);
            bridge.callMainThread(extensionId, "window", "webviewDeserializeResponse", [
              requestId,
              true,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "window", "webviewDeserializeResponse", [
              requestId,
              false,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        sub.dispose();
        bridge.callMainThread(extensionId, "window", "unregisterWebviewPanelSerializer", [
          serializerId,
        ]);
      });

      disposables.add(disposable);
      return disposable;
    },

    createWebviewPanel(
      viewType: string,
      title: string,
      showOptions: ViewColumn | { viewColumn: ViewColumn; preserveFocus?: boolean },
      options?: WebviewPanelOptions & WebviewOptions
    ): WebviewPanel {
      const panelId = crypto.randomUUID();
      const column = typeof showOptions === "number" ? showOptions : showOptions.viewColumn;
      const preserveFocus = typeof showOptions === "object" ? showOptions.preserveFocus : undefined;

      bridge.callMainThread(extensionId, "window", "createWebviewPanel", [
        panelId,
        viewType,
        title,
        column,
        preserveFocus,
        options,
      ]);

      const onDidReceiveMessageEmitter = new EventEmitter<unknown>();
      const onDidChangeViewStateEmitter = new EventEmitter<WebviewPanelOnDidChangeViewStateEvent>();
      const onDidDisposeEmitter = new EventEmitter<void>();

      // Subscribe to webview messages
      const messageSub = bridge.subscribeEvent(
        `webview.${panelId}.message`,
        (message) => {
          onDidReceiveMessageEmitter.fire(message);
        }
      );

      let currentHtml = "";
      let currentOptions: WebviewOptions = options ?? {};

      const webview: Webview = {
        get options() {
          return currentOptions;
        },
        set options(value: WebviewOptions) {
          currentOptions = value;
          bridge.callMainThread(extensionId, "window", "updateWebviewOptions", [
            panelId,
            value,
          ]);
        },
        get html() {
          return currentHtml;
        },
        set html(value: string) {
          currentHtml = value;
          bridge.callMainThread(extensionId, "window", "setWebviewHtml", [
            panelId,
            value,
          ]);
        },
        onDidReceiveMessage: onDidReceiveMessageEmitter.event,
        async postMessage(message: unknown): Promise<boolean> {
          return bridge.callMainThread<boolean>(
            extensionId,
            "window",
            "postWebviewMessage",
            [panelId, message]
          );
        },
        asWebviewUri(localResource: Uri): Uri {
          // Would need to convert local paths to webview-safe URIs
          return localResource;
        },
        cspSource: "https://webview.orion.local",
      };

      const panel: WebviewPanel = {
        viewType,
        title,
        iconPath: undefined,
        webview,
        options: options ?? {},
        viewColumn: column,
        active: true,
        visible: true,
        onDidChangeViewState: onDidChangeViewStateEmitter.event,
        onDidDispose: onDidDisposeEmitter.event,
        reveal(revealColumn?: ViewColumn, revealPreserveFocus?: boolean) {
          bridge.callMainThread(extensionId, "window", "revealWebviewPanel", [
            panelId,
            revealColumn,
            revealPreserveFocus,
          ]);
        },
        dispose() {
          messageSub.dispose();
          onDidReceiveMessageEmitter.dispose();
          onDidChangeViewStateEmitter.dispose();
          onDidDisposeEmitter.fire();
          onDidDisposeEmitter.dispose();
          bridge.callMainThread(extensionId, "window", "disposeWebviewPanel", [panelId]);
        },
      };

      return panel;
    },
  };

  return api;
}

// ============================================================================
// Languages API
// ============================================================================

export interface LanguagesApi {
  /**
   * Get all known language identifiers.
   */
  getLanguages(): Promise<string[]>;

  /**
   * Change the language of a text document.
   */
  setTextDocumentLanguage(document: TextDocument, languageId: string): Promise<TextDocument>;

  /**
   * Register a completion item provider.
   */
  registerCompletionItemProvider(
    selector: DocumentSelector,
    provider: CompletionItemProvider,
    ...triggerCharacters: string[]
  ): Disposable;

  /**
   * Register a hover provider.
   */
  registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable;

  /**
   * Register a definition provider.
   */
  registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable;

  /**
   * Register a type definition provider.
   */
  registerTypeDefinitionProvider(selector: DocumentSelector, provider: TypeDefinitionProvider): Disposable;

  /**
   * Register an implementation provider.
   */
  registerImplementationProvider(selector: DocumentSelector, provider: ImplementationProvider): Disposable;

  /**
   * Register a references provider.
   */
  registerReferenceProvider(selector: DocumentSelector, provider: ReferenceProvider): Disposable;

  /**
   * Register a document highlight provider.
   */
  registerDocumentHighlightProvider(selector: DocumentSelector, provider: DocumentHighlightProvider): Disposable;

  /**
   * Register a document symbol provider.
   */
  registerDocumentSymbolProvider(selector: DocumentSelector, provider: DocumentSymbolProvider, metadata?: { label: string }): Disposable;

  /**
   * Register a workspace symbol provider.
   */
  registerWorkspaceSymbolProvider(provider: WorkspaceSymbolProvider): Disposable;

  /**
   * Register a code action provider.
   */
  registerCodeActionsProvider(selector: DocumentSelector, provider: CodeActionProvider, metadata?: CodeActionProviderMetadata): Disposable;

  /**
   * Register a document formatting edit provider.
   */
  registerDocumentFormattingEditProvider(selector: DocumentSelector, provider: DocumentFormattingEditProvider): Disposable;

  /**
   * Register a document range formatting edit provider.
   */
  registerDocumentRangeFormattingEditProvider(selector: DocumentSelector, provider: DocumentRangeFormattingEditProvider): Disposable;

  /**
   * Register an on type formatting edit provider.
   */
  registerOnTypeFormattingEditProvider(selector: DocumentSelector, provider: OnTypeFormattingEditProvider, firstTriggerCharacter: string, ...moreTriggerCharacter: string[]): Disposable;

  /**
   * Register a signature help provider.
   */
  registerSignatureHelpProvider(selector: DocumentSelector, provider: SignatureHelpProvider, ...triggerCharacters: string[]): Disposable;
  registerSignatureHelpProvider(selector: DocumentSelector, provider: SignatureHelpProvider, metadata: SignatureHelpProviderMetadata): Disposable;

  /**
   * Register a rename provider.
   */
  registerRenameProvider(selector: DocumentSelector, provider: RenameProvider): Disposable;

  /**
   * Register a semantic tokens provider.
   */
  registerDocumentSemanticTokensProvider(selector: DocumentSelector, provider: DocumentSemanticTokensProvider, legend: SemanticTokensLegend): Disposable;

  /**
   * Create a diagnostic collection.
   */
  createDiagnosticCollection(name?: string): DiagnosticCollection;

  /**
   * Get diagnostics for a resource.
   */
  getDiagnostics(resource?: Uri): Diagnostic[] | [Uri, Diagnostic[]][];

  /**
   * Event fired when diagnostics change.
   */
  readonly onDidChangeDiagnostics: Event<DiagnosticChangeEvent>;

  /**
   * Match a document against a selector.
   */
  match(selector: DocumentSelector, document: TextDocument): number;
}

/**
 * Diagnostic change event.
 */
export interface DiagnosticChangeEvent {
  readonly uris: readonly Uri[];
}

/**
 * Create the languages API.
 */
export function createLanguagesApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): LanguagesApi {
  let providerIdCounter = 0;
  let diagnosticCollectionCounter = 0;

  const onDidChangeDiagnosticsEmitter = new EventEmitter<DiagnosticChangeEvent>();
  disposables.add(onDidChangeDiagnosticsEmitter);

  // Subscribe to diagnostic changes from main thread
  disposables.add(
    bridge.subscribeEvent("languages.diagnosticsChanged", (data) => {
      onDidChangeDiagnosticsEmitter.fire(data as DiagnosticChangeEvent);
    })
  );

  function generateProviderId(type: string): string {
    return `${extensionId}.${type}.${++providerIdCounter}`;
  }

  function registerSimpleProvider<T>(
    type: string,
    selector: DocumentSelector,
    handler: (data: unknown) => Promise<T | null | undefined>
  ): Disposable {
    const providerId = generateProviderId(type);

    bridge.callMainThread(extensionId, "languages", `register${capitalize(type)}Provider`, [
      providerId,
      selector,
    ]);

    const sub = bridge.subscribeEvent(
      `languages.${providerId}.provide`,
      async (data) => {
        const { requestId } = data as { requestId: string };
        try {
          const result = await handler(data);
          bridge.callMainThread(extensionId, "languages", `${type}Response`, [
            requestId,
            result,
          ]);
        } catch (error) {
          bridge.callMainThread(extensionId, "languages", `${type}Response`, [
            requestId,
            null,
            String(error),
          ]);
        }
      }
    );

    const disposable = createDisposable(() => {
      sub.dispose();
      bridge.callMainThread(extensionId, "languages", "unregisterProvider", [providerId]);
    });

    disposables.add(disposable);
    return disposable;
  }

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  return {
    async getLanguages(): Promise<string[]> {
      return bridge.callMainThread<string[]>(extensionId, "languages", "getLanguages", []);
    },

    async setTextDocumentLanguage(
      document: TextDocument,
      languageId: string
    ): Promise<TextDocument> {
      return bridge.callMainThread<TextDocument>(
        extensionId,
        "languages",
        "setTextDocumentLanguage",
        [document.uri, languageId]
      );
    },

    registerCompletionItemProvider(
      selector: DocumentSelector,
      provider: CompletionItemProvider,
      ...triggerCharacters: string[]
    ): Disposable {
      const providerId = generateProviderId("completion");

      bridge.callMainThread(extensionId, "languages", "registerCompletionProvider", [
        providerId,
        selector,
        triggerCharacters,
      ]);

      const sub = bridge.subscribeEvent(
        `languages.${providerId}.provide`,
        async (data) => {
          const { requestId, document, position, token, context } = data as {
            requestId: string;
            document: TextDocument;
            position: Position;
            token: CancellationToken;
            context: { triggerKind: CompletionTriggerKind; triggerCharacter?: string };
          };

          try {
            const result = await provider.provideCompletionItems(document, position, token, context);
            bridge.callMainThread(extensionId, "languages", "completionResponse", [
              requestId,
              result,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "languages", "completionResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      // Handle resolve requests if provider supports it
      let resolveSub: Disposable | undefined;
      if (provider.resolveCompletionItem) {
        resolveSub = bridge.subscribeEvent(
          `languages.${providerId}.resolve`,
          async (data) => {
            const { requestId, item, token } = data as {
              requestId: string;
              item: CompletionItem;
              token: CancellationToken;
            };

            try {
              const result = await provider.resolveCompletionItem!(item, token);
              bridge.callMainThread(extensionId, "languages", "completionResolveResponse", [
                requestId,
                result,
              ]);
            } catch (error) {
              bridge.callMainThread(extensionId, "languages", "completionResolveResponse", [
                requestId,
                null,
                String(error),
              ]);
            }
          }
        );
      }

      const disposable = createDisposable(() => {
        sub.dispose();
        resolveSub?.dispose();
        bridge.callMainThread(extensionId, "languages", "unregisterProvider", [providerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
      const providerId = generateProviderId("hover");

      bridge.callMainThread(extensionId, "languages", "registerHoverProvider", [
        providerId,
        selector,
      ]);

      const sub = bridge.subscribeEvent(
        `languages.${providerId}.provide`,
        async (data) => {
          const { requestId, document, position, token } = data as {
            requestId: string;
            document: TextDocument;
            position: Position;
            token: CancellationToken;
          };

          try {
            const result = await provider.provideHover(document, position, token);
            bridge.callMainThread(extensionId, "languages", "hoverResponse", [requestId, result]);
          } catch (error) {
            bridge.callMainThread(extensionId, "languages", "hoverResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        sub.dispose();
        bridge.callMainThread(extensionId, "languages", "unregisterProvider", [providerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerDefinitionProvider(
      selector: DocumentSelector,
      provider: DefinitionProvider
    ): Disposable {
      const providerId = generateProviderId("definition");

      bridge.callMainThread(extensionId, "languages", "registerDefinitionProvider", [
        providerId,
        selector,
      ]);

      const sub = bridge.subscribeEvent(
        `languages.${providerId}.provide`,
        async (data) => {
          const { requestId, document, position, token } = data as {
            requestId: string;
            document: TextDocument;
            position: Position;
            token: CancellationToken;
          };

          try {
            const result = await provider.provideDefinition(document, position, token);
            bridge.callMainThread(extensionId, "languages", "definitionResponse", [
              requestId,
              result,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "languages", "definitionResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        sub.dispose();
        bridge.callMainThread(extensionId, "languages", "unregisterProvider", [providerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerTypeDefinitionProvider(
      selector: DocumentSelector,
      provider: TypeDefinitionProvider
    ): Disposable {
      return registerSimpleProvider("typeDefinition", selector, async (data) => {
        const { document, position, token } = data as {
          document: TextDocument;
          position: Position;
          token: CancellationToken;
        };
        return provider.provideTypeDefinition(document, position, token);
      });
    },

    registerImplementationProvider(
      selector: DocumentSelector,
      provider: ImplementationProvider
    ): Disposable {
      return registerSimpleProvider("implementation", selector, async (data) => {
        const { document, position, token } = data as {
          document: TextDocument;
          position: Position;
          token: CancellationToken;
        };
        return provider.provideImplementation(document, position, token);
      });
    },

    registerReferenceProvider(
      selector: DocumentSelector,
      provider: ReferenceProvider
    ): Disposable {
      return registerSimpleProvider("reference", selector, async (data) => {
        const { document, position, context, token } = data as {
          document: TextDocument;
          position: Position;
          context: ReferenceContext;
          token: CancellationToken;
        };
        return provider.provideReferences(document, position, context, token);
      });
    },

    registerDocumentHighlightProvider(
      selector: DocumentSelector,
      provider: DocumentHighlightProvider
    ): Disposable {
      return registerSimpleProvider("documentHighlight", selector, async (data) => {
        const { document, position, token } = data as {
          document: TextDocument;
          position: Position;
          token: CancellationToken;
        };
        return provider.provideDocumentHighlights(document, position, token);
      });
    },

    registerDocumentSymbolProvider(
      selector: DocumentSelector,
      provider: DocumentSymbolProvider,
      metadata?: { label: string }
    ): Disposable {
      const providerId = generateProviderId("documentSymbol");

      bridge.callMainThread(extensionId, "languages", "registerDocumentSymbolProvider", [
        providerId,
        selector,
        metadata,
      ]);

      const sub = bridge.subscribeEvent(
        `languages.${providerId}.provide`,
        async (data) => {
          const { requestId, document, token } = data as {
            requestId: string;
            document: TextDocument;
            token: CancellationToken;
          };

          try {
            const result = await provider.provideDocumentSymbols(document, token);
            bridge.callMainThread(extensionId, "languages", "documentSymbolResponse", [
              requestId,
              result,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "languages", "documentSymbolResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        sub.dispose();
        bridge.callMainThread(extensionId, "languages", "unregisterProvider", [providerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerWorkspaceSymbolProvider(provider: WorkspaceSymbolProvider): Disposable {
      const providerId = generateProviderId("workspaceSymbol");

      bridge.callMainThread(extensionId, "languages", "registerWorkspaceSymbolProvider", [
        providerId,
      ]);

      const sub = bridge.subscribeEvent(
        `languages.${providerId}.provide`,
        async (data) => {
          const { requestId, query, token } = data as {
            requestId: string;
            query: string;
            token: CancellationToken;
          };

          try {
            const result = await provider.provideWorkspaceSymbols(query, token);
            bridge.callMainThread(extensionId, "languages", "workspaceSymbolResponse", [
              requestId,
              result,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "languages", "workspaceSymbolResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        sub.dispose();
        bridge.callMainThread(extensionId, "languages", "unregisterProvider", [providerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerCodeActionsProvider(
      selector: DocumentSelector,
      provider: CodeActionProvider,
      metadata?: CodeActionProviderMetadata
    ): Disposable {
      const providerId = generateProviderId("codeAction");

      bridge.callMainThread(extensionId, "languages", "registerCodeActionsProvider", [
        providerId,
        selector,
        metadata,
      ]);

      const sub = bridge.subscribeEvent(
        `languages.${providerId}.provide`,
        async (data) => {
          const { requestId, document, range, context, token } = data as {
            requestId: string;
            document: TextDocument;
            range: Range;
            context: CodeActionContext;
            token: CancellationToken;
          };

          try {
            const result = await provider.provideCodeActions(document, range, context, token);
            bridge.callMainThread(extensionId, "languages", "codeActionResponse", [
              requestId,
              result,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "languages", "codeActionResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        sub.dispose();
        bridge.callMainThread(extensionId, "languages", "unregisterProvider", [providerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerDocumentFormattingEditProvider(
      selector: DocumentSelector,
      provider: DocumentFormattingEditProvider
    ): Disposable {
      return registerSimpleProvider("documentFormatting", selector, async (data) => {
        const { document, options, token } = data as {
          document: TextDocument;
          options: FormattingOptions;
          token: CancellationToken;
        };
        return provider.provideDocumentFormattingEdits(document, options, token);
      });
    },

    registerDocumentRangeFormattingEditProvider(
      selector: DocumentSelector,
      provider: DocumentRangeFormattingEditProvider
    ): Disposable {
      return registerSimpleProvider("documentRangeFormatting", selector, async (data) => {
        const { document, range, options, token } = data as {
          document: TextDocument;
          range: Range;
          options: FormattingOptions;
          token: CancellationToken;
        };
        return provider.provideDocumentRangeFormattingEdits(document, range, options, token);
      });
    },

    registerOnTypeFormattingEditProvider(
      selector: DocumentSelector,
      provider: OnTypeFormattingEditProvider,
      firstTriggerCharacter: string,
      ...moreTriggerCharacter: string[]
    ): Disposable {
      const providerId = generateProviderId("onTypeFormatting");
      const triggerCharacters = [firstTriggerCharacter, ...moreTriggerCharacter];

      bridge.callMainThread(extensionId, "languages", "registerOnTypeFormattingEditProvider", [
        providerId,
        selector,
        triggerCharacters,
      ]);

      const sub = bridge.subscribeEvent(
        `languages.${providerId}.provide`,
        async (data) => {
          const { requestId, document, position, ch, options, token } = data as {
            requestId: string;
            document: TextDocument;
            position: Position;
            ch: string;
            options: FormattingOptions;
            token: CancellationToken;
          };

          try {
            const result = await provider.provideOnTypeFormattingEdits(
              document,
              position,
              ch,
              options,
              token
            );
            bridge.callMainThread(extensionId, "languages", "onTypeFormattingResponse", [
              requestId,
              result,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "languages", "onTypeFormattingResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        sub.dispose();
        bridge.callMainThread(extensionId, "languages", "unregisterProvider", [providerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerSignatureHelpProvider(
      selector: DocumentSelector,
      provider: SignatureHelpProvider,
      ...triggerCharactersOrMetadata: (string | SignatureHelpProviderMetadata)[]
    ): Disposable {
      const providerId = generateProviderId("signatureHelp");

      let triggerCharacters: string[];
      let retriggerCharacters: string[] = [];

      if (triggerCharactersOrMetadata.length > 0) {
        const first = triggerCharactersOrMetadata[0];
        if (typeof first === "object" && "triggerCharacters" in first) {
          triggerCharacters = [...first.triggerCharacters];
          retriggerCharacters = [...first.retriggerCharacters];
        } else {
          triggerCharacters = triggerCharactersOrMetadata as string[];
        }
      } else {
        triggerCharacters = [];
      }

      bridge.callMainThread(extensionId, "languages", "registerSignatureHelpProvider", [
        providerId,
        selector,
        triggerCharacters,
        retriggerCharacters,
      ]);

      const sub = bridge.subscribeEvent(
        `languages.${providerId}.provide`,
        async (data) => {
          const { requestId, document, position, context, token } = data as {
            requestId: string;
            document: TextDocument;
            position: Position;
            context: { triggerKind: number; triggerCharacter?: string; isRetrigger: boolean; activeSignatureHelp?: SignatureHelp };
            token: CancellationToken;
          };

          try {
            const result = await provider.provideSignatureHelp(document, position, token, context);
            bridge.callMainThread(extensionId, "languages", "signatureHelpResponse", [
              requestId,
              result,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "languages", "signatureHelpResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        sub.dispose();
        bridge.callMainThread(extensionId, "languages", "unregisterProvider", [providerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerRenameProvider(
      selector: DocumentSelector,
      provider: RenameProvider
    ): Disposable {
      const providerId = generateProviderId("rename");

      bridge.callMainThread(extensionId, "languages", "registerRenameProvider", [
        providerId,
        selector,
      ]);

      const sub = bridge.subscribeEvent(
        `languages.${providerId}.provide`,
        async (data) => {
          const { requestId, document, position, newName, token } = data as {
            requestId: string;
            document: TextDocument;
            position: Position;
            newName: string;
            token: CancellationToken;
          };

          try {
            const result = await provider.provideRenameEdits(document, position, newName, token);
            bridge.callMainThread(extensionId, "languages", "renameResponse", [
              requestId,
              result,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "languages", "renameResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      // Handle prepare rename if provider supports it
      let prepareSub: Disposable | undefined;
      if (provider.prepareRename) {
        prepareSub = bridge.subscribeEvent(
          `languages.${providerId}.prepareRename`,
          async (data) => {
            const { requestId, document, position, token } = data as {
              requestId: string;
              document: TextDocument;
              position: Position;
              token: CancellationToken;
            };

            try {
              const result = await provider.prepareRename!(document, position, token);
              bridge.callMainThread(extensionId, "languages", "prepareRenameResponse", [
                requestId,
                result,
              ]);
            } catch (error) {
              bridge.callMainThread(extensionId, "languages", "prepareRenameResponse", [
                requestId,
                null,
                String(error),
              ]);
            }
          }
        );
      }

      const disposable = createDisposable(() => {
        sub.dispose();
        prepareSub?.dispose();
        bridge.callMainThread(extensionId, "languages", "unregisterProvider", [providerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerDocumentSemanticTokensProvider(
      selector: DocumentSelector,
      provider: DocumentSemanticTokensProvider,
      legend: SemanticTokensLegend
    ): Disposable {
      const providerId = generateProviderId("semanticTokens");

      bridge.callMainThread(extensionId, "languages", "registerDocumentSemanticTokensProvider", [
        providerId,
        selector,
        legend,
      ]);

      const sub = bridge.subscribeEvent(
        `languages.${providerId}.provide`,
        async (data) => {
          const { requestId, document, token } = data as {
            requestId: string;
            document: TextDocument;
            token: CancellationToken;
          };

          try {
            const result = await provider.provideDocumentSemanticTokens(document, token);
            bridge.callMainThread(extensionId, "languages", "semanticTokensResponse", [
              requestId,
              result ? { resultId: result.resultId, data: Array.from(result.data) } : null,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "languages", "semanticTokensResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        sub.dispose();
        bridge.callMainThread(extensionId, "languages", "unregisterProvider", [providerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    createDiagnosticCollection(name?: string): DiagnosticCollection {
      const collectionId = `${extensionId}.diagnostics.${name ?? ++diagnosticCollectionCounter}`;
      const diagnosticsMap = new Map<string, readonly Diagnostic[]>();

      bridge.callMainThread(extensionId, "languages", "createDiagnosticCollection", [
        collectionId,
        name,
      ]);

      const collection: DiagnosticCollection = {
        name: name ?? collectionId,

        set(uriOrEntries: Uri | ReadonlyArray<[Uri, readonly Diagnostic[] | undefined]>, diagnostics?: readonly Diagnostic[]): void {
          if (Array.isArray(uriOrEntries)) {
            // Batch set
            for (const [uri, diags] of uriOrEntries) {
              if (diags) {
                diagnosticsMap.set(uri.toString(), diags);
              } else {
                diagnosticsMap.delete(uri.toString());
              }
            }
            bridge.callMainThread(extensionId, "languages", "setDiagnostics", [
              collectionId,
              uriOrEntries.map(([uri, diags]) => [uri.toString(), diags]),
            ]);
          } else {
            // Single set
            const uri = uriOrEntries;
            if (diagnostics) {
              diagnosticsMap.set(uri.toString(), diagnostics);
            } else {
              diagnosticsMap.delete(uri.toString());
            }
            bridge.callMainThread(extensionId, "languages", "setDiagnostics", [
              collectionId,
              [[uri.toString(), diagnostics]],
            ]);
          }
        },

        delete(uri: Uri): void {
          diagnosticsMap.delete(uri.toString());
          bridge.callMainThread(extensionId, "languages", "deleteDiagnostics", [
            collectionId,
            uri.toString(),
          ]);
        },

        clear(): void {
          diagnosticsMap.clear();
          bridge.callMainThread(extensionId, "languages", "clearDiagnostics", [collectionId]);
        },

        forEach(
          callback: (uri: Uri, diagnostics: readonly Diagnostic[], collection: DiagnosticCollection) => void
        ): void {
          for (const [uriStr, diags] of diagnosticsMap) {
            callback(createUri(uriStr), diags, collection);
          }
        },

        get(uri: Uri): readonly Diagnostic[] | undefined {
          return diagnosticsMap.get(uri.toString());
        },

        has(uri: Uri): boolean {
          return diagnosticsMap.has(uri.toString());
        },

        dispose(): void {
          diagnosticsMap.clear();
          bridge.callMainThread(extensionId, "languages", "disposeDiagnosticCollection", [
            collectionId,
          ]);
        },
      };

      disposables.add(collection);
      return collection;
    },

    getDiagnostics(resource?: Uri): Diagnostic[] | [Uri, Diagnostic[]][] {
      // Would need to fetch from main thread or maintain local cache
      // For now, return empty
      if (resource) {
        return [];
      }
      return [];
    },

    onDidChangeDiagnostics: onDidChangeDiagnosticsEmitter.event,

    match(selector: DocumentSelector, document: TextDocument): number {
      let maxScore = 0;

      for (const filter of selector) {
        let score = 0;

        if (typeof filter === "string") {
          if (filter === "*") {
            score = 5;
          } else if (filter === document.languageId) {
            score = 10;
          }
        } else {
          // DocumentFilter
          if (filter.language) {
            if (filter.language === "*") {
              score += 5;
            } else if (filter.language === document.languageId) {
              score += 10;
            } else {
              continue; // Language doesn't match
            }
          }

          if (filter.scheme) {
            if (filter.scheme === "*") {
              score += 5;
            } else if (filter.scheme === document.uri.scheme) {
              score += 10;
            } else {
              continue; // Scheme doesn't match
            }
          }

          if (filter.pattern) {
            // Simple glob matching
            const pattern = filter.pattern
              .replace(/\*\*/g, ".*")
              .replace(/\*/g, "[^/]*")
              .replace(/\?/g, ".");
            const regex = new RegExp(`^${pattern}$`);
            if (regex.test(document.uri.fsPath)) {
              score += 5;
            }
          }
        }

        maxScore = Math.max(maxScore, score);
      }

      return maxScore;
    },
  };
}

// ============================================================================
// Extension Context
// ============================================================================

/**
 * Extension context provided during activation.
 */
export interface ExtensionContext {
  /**
   * Subscriptions that will be disposed when extension is deactivated.
   */
  readonly subscriptions: Disposable[];

  /**
   * Workspace state (persisted per workspace).
   */
  readonly workspaceState: Memento;

  /**
   * Global state (persisted across workspaces).
   */
  readonly globalState: Memento & { setKeysForSync(keys: string[]): void };

  /**
   * Secret storage for sensitive data.
   */
  readonly secrets: SecretStorage;

  /**
   * Absolute file path of the extension directory.
   */
  readonly extensionPath: string;

  /**
   * URI of the extension directory.
   */
  readonly extensionUri: Uri;

  /**
   * Storage URI for the extension.
   */
  readonly storageUri: Uri | undefined;

  /**
   * Global storage URI for the extension.
   */
  readonly globalStorageUri: Uri;

  /**
   * Log URI for extension logs.
   */
  readonly logUri: Uri;

  /**
   * Extension mode (development, production, test).
   */
  readonly extensionMode: ExtensionMode;

  /**
   * Get the absolute path of a resource in the extension.
   */
  asAbsolutePath(relativePath: string): string;

  /**
   * Environment variables available to the extension.
   */
  readonly environmentVariableCollection: unknown; // Simplified
}

/**
 * Extension mode.
 */
export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}

/**
 * Memento for state storage.
 */
export interface Memento {
  keys(): readonly string[];
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Promise<void>;
}

/**
 * Secret storage.
 */
export interface SecretStorage {
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  readonly onDidChange: Event<SecretStorageChangeEvent>;
}

export interface SecretStorageChangeEvent {
  readonly key: string;
}

// ============================================================================
// Complete Cortex API
// ============================================================================

/**
 * The complete Cortex API exposed to extensions.
 * This is the main API surface available as the `cortex` global object.
 */
export interface CortexAPI {
  // Core namespaces
  readonly commands: CommandsApi;
  readonly workspace: WorkspaceApi;
  readonly window: WindowApi;
  readonly languages: LanguagesApi;

  // New namespaces
  readonly debug: DebugApi;
  readonly tasks: TasksApi;
  readonly scm: ScmApi;
  readonly tests: TestsApi;
  readonly authentication: AuthenticationApi;
  readonly env: EnvApi;
  readonly comments: CommentsApi;
  readonly notebooks: NotebooksApi;
  readonly l10n: L10nApi;

  // Utility types and enums
  readonly Uri: typeof UriHelper;
  readonly Position: typeof PositionHelper;
  readonly Range: typeof RangeHelper;
  readonly Selection: typeof SelectionHelper;
  readonly EndOfLine: typeof EndOfLine;
  readonly CompletionItemKind: typeof CompletionItemKind;
  readonly CompletionTriggerKind: typeof CompletionTriggerKind;
  readonly ConfigurationTarget: typeof ConfigurationTarget;
  readonly ProgressLocation: typeof ProgressLocation;
  readonly ViewColumn: typeof ViewColumn;
  readonly ExtensionMode: typeof ExtensionMode;
  readonly TextEditorCursorStyle: typeof TextEditorCursorStyle;
  readonly TextEditorLineNumbersStyle: typeof TextEditorLineNumbersStyle;
  readonly TextEditorRevealType: typeof TextEditorRevealType;
  readonly LogLevel: typeof LogLevel;
  readonly StatusBarAlignment: typeof StatusBarAlignment;
  readonly DiagnosticSeverity: typeof DiagnosticSeverity;
  readonly DiagnosticTag: typeof DiagnosticTag;
  readonly SymbolKind: typeof SymbolKind;
  readonly DocumentHighlightKind: typeof DocumentHighlightKind;
  readonly CodeActionKind: typeof CodeActionKind;
  readonly CodeActionTriggerKind: typeof CodeActionTriggerKind;
  readonly TreeItemCollapsibleState: typeof TreeItemCollapsibleState;
  readonly TreeItemCheckboxState: typeof TreeItemCheckboxState;

  // Debug-specific enums
  readonly DebugConfigurationProviderTriggerKind: typeof DebugConfigurationProviderTriggerKind;
  readonly DebugConsoleMode: typeof DebugConsoleMode;

  // Tasks-specific enums
  readonly TaskScope: typeof TaskScope;

  // Tests-specific enums
  readonly TestRunProfileKind: typeof TestRunProfileKind;

  // Comments-specific enums
  readonly CommentThreadCollapsibleState: typeof CommentThreadCollapsibleState;
  readonly CommentThreadState: typeof CommentThreadState;
  readonly CommentMode: typeof CommentMode;

  // Notebooks-specific enums
  readonly NotebookCellKind: typeof NotebookCellKind;
  readonly NotebookCellExecutionState: typeof NotebookCellExecutionState;
  readonly NotebookEditorRevealType: typeof NotebookEditorRevealType;

  // Factory functions
  readonly EventEmitter: typeof EventEmitter;
  readonly CancellationTokenSource: typeof CancellationTokenSource;
  readonly Disposable: { from(...disposables: Disposable[]): Disposable };
  readonly MarkdownString: { create(value?: string, isTrusted?: boolean): MarkdownString };
  readonly SnippetString: { create(value?: string): SnippetString };
  readonly ThemeColor: { create(id: string): ThemeColor };
  readonly ThemeIcon: {
    create(id: string, color?: ThemeColor): ThemeIcon;
    File: ThemeIcon;
    Folder: ThemeIcon;
  };
  readonly Location: { create(uri: Uri, rangeOrPosition: Range | Position): Location };
  readonly Diagnostic: {
    create(range: Range, message: string, severity?: DiagnosticSeverity): Diagnostic;
  };
  readonly TextEdit: {
    replace(range: Range, newText: string): TextEdit;
    insert(position: Position, newText: string): TextEdit;
    delete(range: Range): TextEdit;
  };
  readonly WorkspaceEdit: { create(): WorkspaceEdit };
}

/**
 * @deprecated Use CortexAPI instead. OrionAPI is kept for backward compatibility.
 */
export type OrionAPI = CortexAPI;

// Helper classes for API
const UriHelper = {
  file: (path: string) => createUri(path),
  parse: (value: string) => {
    const url = new URL(value);
    return {
      scheme: url.protocol.replace(":", ""),
      authority: url.host,
      path: url.pathname,
      query: url.search.replace("?", ""),
      fragment: url.hash.replace("#", ""),
      fsPath: url.pathname,
      toString: () => value,
    };
  },
  joinPath: (base: Uri, ...pathSegments: string[]) => {
    const newPath = [base.path, ...pathSegments].join("/").replace(/\/+/g, "/");
    return { ...base, path: newPath, fsPath: newPath };
  },
};

const PositionHelper = {
  create: (line: number, character: number): Position => createPosition(line, character),
};

const RangeHelper = {
  create: (startLine: number, startChar: number, endLine: number, endChar: number): Range =>
    createRange(startLine, startChar, endLine, endChar),
};

const SelectionHelper = {
  create: (
    anchorLine: number,
    anchorChar: number,
    activeLine: number,
    activeChar: number
  ): Selection => createSelection(anchorLine, anchorChar, activeLine, activeChar),
};

/**
 * Options for creating the Cortex API.
 */
export interface CortexAPIOptions {
  /**
   * Environment configuration.
   */
  envConfig?: EnvApiConfig;

  /**
   * Localization configuration.
   */
  l10nConfig?: L10nConfig;
}

/**
 * Create the complete Cortex API for an extension.
 */
export function createCortexAPI(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore,
  workspaceFolders: WorkspaceFolder[],
  options?: CortexAPIOptions
): CortexAPI {
  // Use default configs if not provided
  const envConfig = options?.envConfig ?? createDefaultEnvConfig();
  const l10nConfig = options?.l10nConfig ?? createDefaultL10nConfig();

  return {
    // Core namespaces
    commands: createCommandsApi(extensionId, bridge, disposables),
    workspace: createWorkspaceApi(extensionId, bridge, disposables, workspaceFolders),
    window: createWindowApi(extensionId, bridge, disposables),
    languages: createLanguagesApi(extensionId, bridge, disposables),

    // New namespaces
    debug: createDebugApi(extensionId, bridge, disposables),
    tasks: createTasksApi(extensionId, bridge, disposables),
    scm: createScmApi(extensionId, bridge, disposables),
    tests: createTestsApi(extensionId, bridge, disposables),
    authentication: createAuthenticationApi(extensionId, bridge, disposables),
    env: createEnvApi(extensionId, bridge, disposables, envConfig),
    comments: createCommentsApi(extensionId, bridge, disposables),
    notebooks: createNotebooksApi(extensionId, bridge, disposables),
    l10n: createL10nApi(extensionId, bridge, disposables, l10nConfig),

    // Expose types and enums
    Uri: UriHelper,
    Position: PositionHelper,
    Range: RangeHelper,
    Selection: SelectionHelper,
    EndOfLine,
    CompletionItemKind,
    CompletionTriggerKind,
    ConfigurationTarget,
    ProgressLocation,
    ViewColumn,
    ExtensionMode,
    TextEditorCursorStyle,
    TextEditorLineNumbersStyle,
    TextEditorRevealType,
    LogLevel,
    StatusBarAlignment,
    DiagnosticSeverity,
    DiagnosticTag,
    SymbolKind,
    DocumentHighlightKind,
    CodeActionKind,
    CodeActionTriggerKind,
    TreeItemCollapsibleState,
    TreeItemCheckboxState,

    // Debug-specific enums
    DebugConfigurationProviderTriggerKind,
    DebugConsoleMode,

    // Tasks-specific enums
    TaskScope,

    // Tests-specific enums
    TestRunProfileKind,

    // Comments-specific enums
    CommentThreadCollapsibleState,
    CommentThreadState,
    CommentMode,

    // Notebooks-specific enums
    NotebookCellKind,
    NotebookCellExecutionState,
    NotebookEditorRevealType,

    // Factories
    EventEmitter,
    CancellationTokenSource,
    Disposable: {
      from(...disposableLikes: Disposable[]): Disposable {
        return createDisposable(() => {
          disposableLikes.forEach((d) => d.dispose());
        });
      },
    },
    MarkdownString: {
      create: (value?: string, isTrusted?: boolean) => createMarkdownString(value, isTrusted),
    },
    SnippetString: {
      create: (value?: string) => createSnippetString(value),
    },
    ThemeColor: {
      create: (id: string): ThemeColor => ({ id }),
    },
    ThemeIcon: {
      create: (id: string, color?: ThemeColor): ThemeIcon => ({ id, color }),
      File: { id: "file" },
      Folder: { id: "folder" },
    },
    Location: {
      create: (uri: Uri, rangeOrPosition: Range | Position): Location => ({
        uri,
        range: "start" in rangeOrPosition
          ? rangeOrPosition
          : createRange(rangeOrPosition, rangeOrPosition),
      }),
    },
    Diagnostic: {
      create: (
        range: Range,
        message: string,
        severity: DiagnosticSeverity = DiagnosticSeverity.Error
      ): Diagnostic => ({
        range,
        message,
        severity,
      }),
    },
    TextEdit: {
      replace: (range: Range, newText: string): TextEdit => ({ range, newText }),
      insert: (position: Position, newText: string): TextEdit => ({
        range: createRange(position, position),
        newText,
      }),
      delete: (range: Range): TextEdit => ({ range, newText: "" }),
    },
    WorkspaceEdit: {
      create: (): WorkspaceEdit => createWorkspaceEditImpl(),
    },
  };
}

/**
 * @deprecated Use createCortexAPI instead. createOrionAPI is kept for backward compatibility.
 */
export function createOrionAPI(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore,
  workspaceFolders: WorkspaceFolder[]
): CortexAPI {
  return createCortexAPI(extensionId, bridge, disposables, workspaceFolders);
}

/**
 * Create a workspace edit implementation.
 */
function createWorkspaceEditImpl(): WorkspaceEdit {
  const edits = new Map<string, TextEdit[]>();
  const fileOps: Array<{
    type: "create" | "delete" | "rename";
    uri: Uri;
    newUri?: Uri;
    options?: Record<string, unknown>;
  }> = [];

  return {
    get size(): number {
      let count = 0;
      for (const e of edits.values()) {
        count += e.length;
      }
      return count + fileOps.length;
    },

    replace(uri: Uri, range: Range, newText: string): void {
      const key = uri.toString();
      const arr = edits.get(key) ?? [];
      arr.push({ range, newText });
      edits.set(key, arr);
    },

    insert(uri: Uri, position: Position, newText: string): void {
      this.replace(uri, createRange(position, position), newText);
    },

    delete(uri: Uri, range: Range): void {
      this.replace(uri, range, "");
    },

    has(uri: Uri): boolean {
      return edits.has(uri.toString());
    },

    set(uri: Uri, textEdits: readonly TextEdit[] | readonly [TextEdit, unknown][]): void {
      if (textEdits.length === 0) {
        edits.delete(uri.toString());
      } else {
        const arr: TextEdit[] = [];
        for (const item of textEdits) {
          if (Array.isArray(item)) {
            arr.push(item[0]);
          } else {
            arr.push(item);
          }
        }
        edits.set(uri.toString(), arr);
      }
    },

    get(uri: Uri): TextEdit[] {
      return edits.get(uri.toString()) ?? [];
    },

    createFile(uri: Uri, options?: { overwrite?: boolean; ignoreIfExists?: boolean }): void {
      fileOps.push({ type: "create", uri, options });
    },

    deleteFile(uri: Uri, options?: { recursive?: boolean; ignoreIfNotExists?: boolean }): void {
      fileOps.push({ type: "delete", uri, options });
    },

    renameFile(
      oldUri: Uri,
      newUri: Uri,
      options?: { overwrite?: boolean; ignoreIfExists?: boolean }
    ): void {
      fileOps.push({ type: "rename", uri: oldUri, newUri, options });
    },

    entries(): [Uri, TextEdit[]][] {
      const result: [Uri, TextEdit[]][] = [];
      for (const [uriStr, textEdits] of edits) {
        result.push([createUri(uriStr), textEdits]);
      }
      return result;
    },
  };
}

// ============================================================================
// Re-exports from API modules
// ============================================================================

// Debug API types
export type { DebugApi } from "./api/debug";
export { DebugConfigurationProviderTriggerKind, DebugConsoleMode } from "./api/debug";
export type {
  DebugSession,
  DebugConfiguration,
  DebugSessionOptions,
  Breakpoint,
  SourceBreakpoint,
  FunctionBreakpoint,
  DataBreakpoint,
  DebugAdapterDescriptor,
  DebugAdapterExecutable,
  DebugAdapterServer,
  DebugAdapterDescriptorFactory,
  DebugAdapterTrackerFactory,
  DebugAdapterTracker,
  DebugConfigurationProvider,
  BreakpointsChangeEvent,
  DebugConsole,
  DebugSessionCustomEvent,
} from "./api/debug";

// Tasks API types
export type { TasksApi, Task, TaskDefinition, TaskExecution, TaskStartEvent, TaskEndEvent, TaskFilter, TaskProvider } from "./api/tasks";
export { TaskScope } from "./api/tasks";

// SCM API types
export type { ScmApi, SourceControl, SourceControlInputBox, SourceControlResourceGroup, SourceControlResourceState, QuickDiffProvider } from "./api/scm";

// Tests API types
export type { TestsApi, TestController, TestItem, TestItemCollection, TestTag, TestRunProfile, TestRun, TestRunRequest, TestMessage } from "./api/tests";
export { TestRunProfileKind } from "./api/tests";

// Authentication API types
export type { AuthenticationApi, AuthenticationProvider, AuthenticationSession, AuthenticationSessionAccountInformation, AuthenticationGetSessionOptions } from "./api/authentication";

// Environment API types
export type { EnvApi, Clipboard, EnvApiConfig } from "./api/env";

// Comments API types
export type { CommentsApi, CommentController, CommentThread, Comment as CommentItem, CommentAuthorInformation, CommentReaction, CommentingRangeProvider } from "./api/comments";
export { CommentThreadCollapsibleState, CommentThreadState, CommentMode } from "./api/comments";

// Notebooks API types
export type { NotebooksApi, NotebookDocument, NotebookCell, NotebookCellData, NotebookCellOutput, NotebookData, NotebookRange, NotebookEditor, NotebookSerializer, NotebookController, NotebookCellExecution } from "./api/notebooks";
export { NotebookCellKind, NotebookCellExecutionState, NotebookEditorRevealType, createNotebookRange, createTextOutputItem, createJsonOutputItem, createErrorOutputItem, createNotebookCellOutput } from "./api/notebooks";

// L10n API types
export type { L10nApi, L10nMessage, L10nBundle, L10nConfig } from "./api/l10n";
export { createDefaultL10nConfig, loadBundleFromJson } from "./api/l10n";
