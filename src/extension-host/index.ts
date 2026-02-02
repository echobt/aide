/**
 * Extension Host System
 *
 * Provides sandboxed execution environment for Orion extensions.
 * Extensions run in Web Workers with controlled API access.
 *
 * @example
 * ```typescript
 * import { createExtensionHost, ExtensionDescription } from './extension-host';
 *
 * const extensions: ExtensionDescription[] = [
 *   {
 *     id: 'my-extension',
 *     name: 'My Extension',
 *     version: '1.0.0',
 *     path: '/extensions/my-extension',
 *     main: 'dist/extension.js',
 *     activationEvents: ['onLanguage:typescript'],
 *     dependencies: [],
 *     extensionKind: [ExtensionKind.Workspace],
 *   }
 * ];
 *
 * const host = await createExtensionHost({
 *   workerPath: '/extension-host-worker.js',
 *   extensions,
 *   workspaceFolders: [],
 * });
 *
 * // Listen for extension events
 * host.onExtensionActivated((payload) => {
 *   console.log(`Extension ${payload.extensionId} activated`);
 * });
 *
 * // Execute commands
 * await host.executeCommand('my-extension.doSomething', arg1, arg2);
 *
 * // Send events to extensions
 * host.sendEvent('workspace.documentOpened', documentData);
 *
 * // Cleanup
 * await host.stop();
 * host.dispose();
 * ```
 */

// ============================================================================
// Core Types
// ============================================================================

// Type-only exports (interfaces and type aliases)
export type {
  // Disposable pattern
  Disposable,

  // Events
  Event,
  EventHandler,

  // URI and Position
  Uri,
  Position,
  Range,
  Selection,

  // Document types
  TextDocument,
  TextLine,
  TextDocumentChangeEvent,
  TextDocumentContentChangeEvent,

  // Workspace types
  WorkspaceFolder,
  WorkspaceConfiguration,
  ConfigurationInspect,

  // Window types
  OutputChannel,
  LogOutputChannel,
  QuickPickItem,
  QuickPickOptions,
  InputBoxOptions,
  MessageItem,
  MessageOptions,
  ProgressOptions,
  Progress,
  CancellationToken,
  StatusBarItem,
  ThemeColor,
  ThemeIcon,
  Command,
  QuickInputButton,
  AccessibilityInformation,
  WorkspaceEditEntryMetadata,

  // Language types
  DocumentSelector,
  DocumentFilter,
  CompletionItem,
  CompletionItemLabel,
  CompletionList,
  CompletionContext,
  CompletionItemProvider,
  Hover,
  HoverProvider,
  DefinitionProvider,
  TypeDefinitionProvider,
  ImplementationProvider,
  ReferenceProvider,
  ReferenceContext,
  DocumentHighlightProvider,
  DocumentHighlight,
  DocumentSymbolProvider,
  DocumentSymbol,
  SymbolInformation,
  WorkspaceSymbolProvider,
  CodeActionProvider,
  CodeAction,
  CodeActionContext,
  CodeActionProviderMetadata,
  DocumentFormattingEditProvider,
  DocumentRangeFormattingEditProvider,
  OnTypeFormattingEditProvider,
  FormattingOptions,
  SignatureHelpProvider,
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
  SignatureHelpContext,
  SignatureHelpProviderMetadata,
  RenameProvider,
  DocumentSemanticTokensProvider,
  SemanticTokensLegend,
  SemanticTokens,
  SemanticTokensEdits,
  SemanticTokensEdit,
  SemanticTokensBuilder,
  DiagnosticCollection,
  Diagnostic,
  DiagnosticRelatedInformation,
  Definition,
  DefinitionLink,
  Location,
  MarkdownString,
  SnippetString,
  TextEdit,
  WorkspaceEdit,
  FileSystemWatcher,
  FileStat,

  // Extension types
  ExtensionDescription,
  ExtensionCapabilities,
  ExtensionRuntimeState,

  // Message types
  ExtensionHostMessage,
  InitializePayload,
  PlatformInfo,
  ApiRequestPayload,
  ApiResponsePayload,
  EventPayload,
  ExtensionActivatedPayload,
  ExtensionErrorPayload,
  PendingRequest,

  // Resource types
  ResourceLimits,
} from "./types";

// Value exports (classes, enums, and functions)
export {
  // Disposable pattern
  DisposableStore,
  MutableDisposable,
  createDisposable,

  // Events
  EventEmitter,
  relayEvent,

  // URI and Position
  createUri,
  createPosition,
  createRange,
  createSelection,

  // Document types
  EndOfLine,
  TextDocumentChangeReason,

  // Workspace types
  ConfigurationTarget,

  // Window types
  QuickPickItemKind,
  ProgressLocation,
  CancellationTokenSource,
  StatusBarAlignment,
  ViewColumn,

  // Language types
  CompletionItemKind,
  CompletionItemTag,
  CompletionTriggerKind,
  DocumentHighlightKind,
  SymbolKind,
  SymbolTag,
  CodeActionKind,
  CodeActionTriggerKind,
  SignatureHelpTriggerKind,
  DiagnosticSeverity,
  DiagnosticTag,
  createMarkdownString,
  createSnippetString,
  createTextEdit,
  FileType,
  FilePermission,

  // Extension types
  ExtensionKind,
  ExtensionStatus,

  // Message types
  ExtensionHostMessageType,
  LogLevel,
} from "./types";

// ============================================================================
// API Types
// ============================================================================

// Type-only exports from ExtensionAPI
export type {
  // API interfaces
  CommandsApi,
  WorkspaceApi,
  WindowApi,
  LanguagesApi,
  OrionAPI,

  // API bridge
  ExtensionApiBridge,

  // Window types
  TextEditor,
  TextEditorOptions,
  TextEditorEdit,
  TextEditorDecorationType,
  DecorationOptions,
  DecorationRenderOptions,

  // Workspace additional types
  WorkspaceFoldersChangeEvent,
  TextDocumentChangeEvent as ApiTextDocumentChangeEvent,
  TextDocumentContentChangeEvent as ApiTextDocumentContentChangeEvent,

  // Terminal types
  Terminal,
  TerminalOptions,
  TerminalExitStatus,
  TerminalState,
  TerminalEditorLocationOptions,
  TerminalSplitLocationOptions,

  // Dialog types
  OpenDialogOptions,
  SaveDialogOptions,

  // Tree view types
  TreeDataProvider,
  TreeItem,
  TreeItemLabel,
  TreeView,
  TreeViewOptions,
  TreeViewExpansionEvent,
  TreeViewSelectionChangeEvent,
  TreeViewVisibilityChangeEvent,
  TreeCheckboxChangeEvent,
  TreeDragAndDropController,
  ViewBadge,

  // Webview types
  Webview,
  WebviewPanel,
  WebviewPanelOptions,
  WebviewOptions,
  WebviewPortMapping,
  WebviewPanelSerializer,
  WebviewPanelOnDidChangeViewStateEvent,

  // Data transfer types
  DataTransfer,
  DataTransferItem,
  DataTransferFile,

  // Diagnostic change event
  DiagnosticChangeEvent,
} from "./ExtensionAPI";

// Value exports from ExtensionAPI (functions, enums, classes)
export {
  // API factory functions
  createOrionAPI,
  createCommandsApi,
  createWorkspaceApi,
  createWindowApi,
  createLanguagesApi,

  // Enums
  TextEditorCursorStyle,
  TextEditorLineNumbersStyle,
  TextEditorRevealType,
  TerminalExitReason,
  TerminalLocation,
  TreeItemCollapsibleState,
  TreeItemCheckboxState,
} from "./ExtensionAPI";

// ============================================================================
// Extension Context
// ============================================================================

export type {
  ExtensionContext,
  Memento,
  SecretStorage,
  SecretStorageChangeEvent,
} from "./ExtensionAPI";

export { ExtensionMode } from "./ExtensionAPI";

export type {
  CreateExtensionContextOptions,
  ExtensionLogger,
  ExecutionGuard,
  ResourceUsage,
} from "./ExtensionContext";

export {
  createExtensionContext,
  createMemento,
  createSecretStorage,
  createExtensionLogger,
  createSandboxGlobals,
  createExecutionGuard,
} from "./ExtensionContext";

// ============================================================================
// Extension Activator
// ============================================================================

export type {
  // Activation types
  ActivationEventType,
  ParsedActivationEvent,

  // Extension module
  ExtensionModule,
  ActivatedExtension,

  // Activator options
  ExtensionActivatorOptions,
} from "./ExtensionActivator";

export {
  // Activation functions
  parseActivationEvent,
  matchesActivationEvent,
  ActivationEvents,

  // Dependency graph
  ExtensionDependencyGraph,

  // Activator class
  ExtensionActivator,
} from "./ExtensionActivator";

// ============================================================================
// Extension Host Main Thread
// ============================================================================

export type {
  // Configuration
  ExtensionHostConfig,

  // State
  ExtensionHostState as MainExtensionHostState,

  // API handlers
  ApiHandler,
  ApiNamespaceHandlers,
} from "./ExtensionHostMain";

export {
  // Status enum
  ExtensionHostStatus,

  // Main coordinator
  ExtensionHostMain,
  createExtensionHost,
} from "./ExtensionHostMain";

// ============================================================================
// Extension Host Worker (for worker entry point)
// ============================================================================

// Worker exports are used when bundling the worker entry point
// They are not directly used from the main thread
// See ExtensionHostWorker.ts for the worker implementation

// ============================================================================
// Web Extension Host
// ============================================================================

export type {
  // Types
  WebExtensionManifest,
  WebExtensionDescription,
  WebExtensionAPI,
  WebExtensionMessage,
  WebExtensionHostConfig,
} from "./WebExtensionHost";

export {
  // Enums
  WebExtensionKind,
  WebExtensionMessageType,

  // Classes
  WebExtensionSandbox,
  WebExtensionHost,

  // Factory
  createWebExtensionHost,

  // Helpers
  isWebExtension,
  canRunInWebContext,
  getExtensionKindStrings,
  toWebExtensionDescription,
} from "./WebExtensionHost";

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extension manifest matching backend schema.
 */
export interface ExtensionManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main?: string;
  activationEvents?: string[];
  dependencies?: string[];
  extensionKind?: ("ui" | "workspace")[];
  contributes?: {
    commands?: Array<{
      command: string;
      title: string;
      category?: string;
    }>;
    languages?: Array<{
      id: string;
      extensions?: string[];
      aliases?: string[];
    }>;
    themes?: Array<{
      id: string;
      label: string;
      path: string;
    }>;
    [key: string]: unknown;
  };
}

/**
 * Convert extension manifest to description.
 */
export function manifestToDescription(
  manifest: ExtensionManifest,
  path: string
): import("./types").ExtensionDescription {
  return {
    id: manifest.name,
    name: manifest.name,
    version: manifest.version,
    path,
    main: manifest.main ?? "dist/extension.js",
    activationEvents: manifest.activationEvents ?? ["*"],
    dependencies: manifest.dependencies ?? [],
    extensionKind: (manifest.extensionKind ?? ["workspace"]).map((k) =>
      k === "ui" ? 1 : 2
    ),
  };
}

/**
 * Extension load result.
 */
export interface ExtensionLoadResult {
  success: boolean;
  extensionId: string;
  activationTime?: number;
  error?: string;
}

/**
 * Extension host statistics.
 */
export interface ExtensionHostStats {
  status: import("./ExtensionHostMain").ExtensionHostStatus;
  uptime: number;
  extensionCount: number;
  activeExtensions: number;
  totalActivationTime: number;
  restartCount: number;
  memoryUsage?: number;
}

/**
 * Get extension host statistics.
 */
export function getExtensionHostStats(
  host: import("./ExtensionHostMain").ExtensionHostMain
): ExtensionHostStats {
  const states = host.getAllExtensionStates();
  const activeStates = states.filter(
    (s) => s.status === ("active" as import("./types").ExtensionStatus)
  );

  return {
    status: host.getStatus(),
    uptime: 0, // Would need to track in host
    extensionCount: states.length,
    activeExtensions: activeStates.length,
    totalActivationTime: activeStates.reduce(
      (sum, s) => sum + (s.activationTime ?? 0),
      0
    ),
    restartCount: 0, // Would need to track in host
  };
}

// ============================================================================
// SolidJS Integration
// ============================================================================

export type {
  // Provider types
  ExtensionHostProviderProps,
  ExtensionHostContextValue,
  ExtensionLogEntry,
} from "./useExtensionHost";

export {
  // Provider component
  ExtensionHostProvider,

  // Hooks
  useExtensionHost,
  useExtension,
  useExtensionActive,
  useCommand,
  useExtensionLogs,
  useExtensionEvent,

  // Helpers
  createExtensionDescriptions,
  createWorkspaceFolders,
} from "./useExtensionHost";

// ============================================================================
// Contributions System
// ============================================================================

export type {
  // Views contribution types
  RegisteredViewContainer,
  RegisteredView,
  ViewContainerRegistrationOptions,
  ViewRegistrationOptions,
  ViewContainerRegisteredEvent,
  ViewRegisteredEvent,
  ViewVisibilityChangedEvent,
  ViewContainerVisibilityChangedEvent,
  ViewsApi,
  ViewContainer,
  View,

  // Menus contribution types
  MenuLocation,
  MenuItem,
  RegisteredMenuItem,
  Submenu,
  RegisteredSubmenu,
  ResolvedMenuItem,
  MenusChangedEvent,
  WhenClauseContext,
  MenusApi,
} from "./contributions";

export {
  // Views contribution
  ViewsContributionRegistry,
  getViewsRegistry,
  resetViewsRegistry,
  createViewsApi,

  // Menus contribution
  WhenClauseEvaluator,
  MenuRegistry,
  getGlobalMenuRegistry,
  resetGlobalMenuRegistry,
  createMenusApi,
  createDefaultContextProvider,
} from "./contributions";
