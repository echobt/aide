/**
 * Extension Host API Index
 *
 * Exports all API namespaces for the Cortex IDE extension host.
 */

// Debug API
export {
  createDebugApi,
  DebugConfigurationProviderTriggerKind,
  DebugConsoleMode,
} from "./debug";
export type {
  DebugApi,
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
} from "./debug";

// Tasks API
export {
  createTasksApi,
  TaskScope,
} from "./tasks";
export type {
  TasksApi,
  Task,
  TaskDefinition,
  TaskExecution,
  TaskStartEvent,
  TaskEndEvent,
  TaskProcessStartEvent,
  TaskProcessEndEvent,
  TaskFilter,
  TaskProvider,
  TaskPresentationOptions,
  RunOptions,
} from "./tasks";

// SCM API
export { createScmApi } from "./scm";
export type {
  ScmApi,
  SourceControl,
  SourceControlInputBox,
  SourceControlResourceGroup,
  SourceControlResourceState,
  SourceControlResourceDecorations,
  QuickDiffProvider,
} from "./scm";

// Tests API
export {
  createTestsApi,
  TestRunProfileKind,
  createTestTag,
  createTestMessage,
  createTestMessageDiff,
} from "./tests";
export type {
  TestsApi,
  TestController,
  TestItem,
  TestItemCollection,
  TestTag,
  TestRunProfile,
  TestRun,
  TestRunRequest,
  TestMessage,
  FileCoverage,
} from "./tests";

// Authentication API
export {
  createAuthenticationApi,
  BaseOAuthAuthenticationProvider,
} from "./authentication";
export type {
  AuthenticationApi,
  AuthenticationProvider,
  AuthenticationSession,
  AuthenticationSessionAccountInformation,
  AuthenticationProviderInformation,
  AuthenticationGetSessionOptions,
  AuthenticationSessionsChangeEvent,
  AuthenticationProviderOptions,
} from "./authentication";

// Environment API
export {
  createEnvApi,
  createDefaultEnvConfig,
} from "./env";
export type {
  EnvApi,
  Clipboard,
  EnvApiConfig,
} from "./env";

// Comments API
export {
  createCommentsApi,
  CommentThreadCollapsibleState,
  CommentThreadState,
  CommentMode,
} from "./comments";
export type {
  CommentsApi,
  CommentController,
  CommentThread,
  Comment,
  CommentAuthorInformation,
  CommentReaction,
  CommentingRangeProvider,
  CommentOptions,
} from "./comments";

// Notebooks API
export {
  createNotebooksApi,
  NotebookCellKind,
  NotebookCellExecutionState,
  NotebookEditorRevealType,
  createNotebookRange,
  createTextOutputItem,
  createJsonOutputItem,
  createErrorOutputItem,
  createNotebookCellOutput,
} from "./notebooks";
export type {
  NotebooksApi,
  NotebookDocument,
  NotebookCell,
  NotebookCellData,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookData,
  NotebookRange,
  NotebookEditor,
  NotebookSerializer,
  NotebookController,
  NotebookCellExecution,
  NotebookDocumentChangeEvent,
  NotebookDocumentContentChange,
  NotebookDocumentCellChange,
  NotebookCellExecutionSummary,
  NotebookDocumentContentOptions,
} from "./notebooks";

// L10n API
export {
  createL10nApi,
  createDefaultL10nConfig,
  loadBundleFromJson,
  loadBundle,
  formatMessage,
  normalizeBundleContents,
  getBundleFilePaths,
  detectLanguage,
  createBundle,
  mergeBundles,
  createL10nConfigForExtension,
} from "./l10n";
export type {
  L10nApi,
  L10nMessage,
  L10nBundle,
  L10nBundleRaw,
  L10nConfig,
  LoadBundleOptions,
} from "./l10n";
