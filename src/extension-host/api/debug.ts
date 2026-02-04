/**
 * Debug API for Extensions (cortex.debug)
 *
 * Provides the `cortex.debug` namespace for extensions to interact with
 * the debugger. Bridges extension requests to the DebugContext in the main thread.
 *
 * Implements VS Code compatible debug API surface for extension compatibility.
 *
 * @module extension-host/api/debug
 */

import {
  Disposable,
  DisposableStore,
  EventEmitter,
  Event,
  createDisposable,
  Uri,
  createUri,
  CancellationToken,
} from "../types";
import type { ExtensionApiBridge } from "../ExtensionAPI";

// ============================================================================
// Debug Types
// ============================================================================

/**
 * A debug session.
 */
export interface DebugSession {
  /**
   * The unique ID of this debug session.
   */
  readonly id: string;

  /**
   * The debug session's type from the debug configuration.
   */
  readonly type: string;

  /**
   * The parent session of this debug session, if it was created as a child.
   */
  readonly parentSession?: DebugSession;

  /**
   * The debug session's name.
   */
  readonly name: string;

  /**
   * The workspace folder of this session or undefined for a folderless setup.
   */
  readonly workspaceFolder: { uri: Uri; name: string; index: number } | undefined;

  /**
   * The "resolved" debug configuration of this session.
   */
  readonly configuration: DebugConfiguration;

  /**
   * Send a custom request to the debug adapter.
   */
  customRequest(command: string, args?: unknown): Promise<unknown>;

  /**
   * Get the debug protocol breakpoints for a source URI.
   */
  getDebugProtocolBreakpoint(breakpoint: Breakpoint): Promise<DebugProtocolBreakpoint | undefined>;
}

/**
 * Configuration for a debug session.
 */
export interface DebugConfiguration {
  /**
   * The type of the debug session.
   */
  type: string;

  /**
   * The name of the debug session.
   */
  name: string;

  /**
   * The request type of the debug session.
   */
  request: string;

  /**
   * Additional attributes used by debug adapters.
   */
  [key: string]: unknown;
}

/**
 * Options for starting a debug session.
 */
export interface DebugSessionOptions {
  /**
   * When specified the newly created debug session is registered as a "child" session of this
   * "parent" debug session.
   */
  parentSession?: DebugSession;

  /**
   * Controls whether lifecycle requests like 'restart' are sent to the newly created session
   * or its parent session. By default (if the property is false or missing), lifecycle
   * requests are sent to the new session. This property is ignored if the session has no parent session.
   */
  lifecycleManagedByParent?: boolean;

  /**
   * Controls whether this session should have a separate debug console or share it
   * with the parent session. Has no effect for sessions which do not have a parent session.
   * Defaults to Separate.
   */
  consoleMode?: DebugConsoleMode;

  /**
   * Controls whether this session should run without debugging, thus ignoring breakpoints.
   * When this property is not specified, the value from the parent session (if there is one)
   * is used.
   */
  noDebug?: boolean;

  /**
   * Controls if the debug session's parent session is shown in the CALL STACK view
   * even if it has only a single child. By default, the debug session's parent session
   * is never hidden in the CALL STACK view.
   */
  compact?: boolean;

  /**
   * Signals to the debug adapter that the value of 'supportsDebugAdapterTracker' in
   * the debug adapter's capabilities is not honored. The debug adapter will receive
   * DebugAdapterTracker callbacks.
   */
  suppressDebugView?: boolean;

  /**
   * Signals that debug tool bar should not be shown for this session.
   */
  suppressDebugToolbar?: boolean;

  /**
   * Signals that save all before starting debug should not be done for this session.
   */
  suppressSaveBeforeStart?: boolean;

  /**
   * When true, a save will be triggered for open editors when starting a debug session.
   */
  testRun?: unknown;
}

/**
 * Debug console mode.
 */
export enum DebugConsoleMode {
  /**
   * Debug session should have a separate debug console.
   */
  Separate = 0,

  /**
   * Debug session should share debug console with its parent session.
   * This value has no effect for sessions which do not have a parent session.
   */
  MergeWithParent = 1,
}

/**
 * A breakpoint.
 */
export interface Breakpoint {
  /**
   * The unique ID of the breakpoint.
   */
  readonly id: string;

  /**
   * Is breakpoint enabled.
   */
  readonly enabled: boolean;

  /**
   * An optional expression for conditional breakpoints.
   */
  readonly condition?: string;

  /**
   * An optional expression that controls how many hits of the breakpoint are ignored.
   */
  readonly hitCondition?: string;

  /**
   * An optional log message to display when hitting the breakpoint.
   */
  readonly logMessage?: string;
}

/**
 * A breakpoint specified by a source location.
 */
export interface SourceBreakpoint extends Breakpoint {
  /**
   * The source and line position of this breakpoint.
   */
  readonly location: Location;
}

/**
 * A breakpoint specified by a function name.
 */
export interface FunctionBreakpoint extends Breakpoint {
  /**
   * The name of the function to which this breakpoint is attached.
   */
  readonly functionName: string;
}

/**
 * A breakpoint specified by a data address and byte length.
 */
export interface DataBreakpoint extends Breakpoint {
  /**
   * A label for this data breakpoint.
   */
  readonly label: string;

  /**
   * The data ID of the breakpoint.
   */
  readonly dataId: string;

  /**
   * Whether the breakpoint could be persisted across sessions.
   */
  readonly canPersist: boolean;

  /**
   * The access type for this breakpoint.
   */
  readonly accessType?: DataBreakpointAccessType;

  /**
   * The access types for this breakpoint.
   * @deprecated Use accessType instead
   */
  readonly accessTypes?: DataBreakpointAccessType[];
}

/**
 * Data breakpoint access type.
 */
export type DataBreakpointAccessType = "read" | "write" | "readWrite";

/**
 * Instruction breakpoint for debugging at assembly level.
 */
export interface InstructionBreakpoint extends Breakpoint {
  /**
   * The instruction reference.
   */
  readonly instructionReference: string;

  /**
   * The offset from the instruction reference.
   */
  readonly offset?: number;
}

/**
 * Location in a source file.
 */
export interface Location {
  uri: Uri;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

/**
 * Debug protocol breakpoint.
 */
export interface DebugProtocolBreakpoint {
  /**
   * If true, the breakpoint could be set (but not necessarily at the desired location).
   */
  verified: boolean;

  /**
   * An optional identifier for the breakpoint.
   */
  id?: number;

  /**
   * An optional message about the state of the breakpoint.
   */
  message?: string;

  /**
   * The source where the breakpoint is located.
   */
  source?: DebugProtocolSource;

  /**
   * The start line of the actual range covered by the breakpoint.
   */
  line?: number;

  /**
   * The start column of the actual range covered by the breakpoint.
   */
  column?: number;

  /**
   * The end line of the actual range covered by the breakpoint.
   */
  endLine?: number;

  /**
   * The end column of the actual range covered by the breakpoint.
   */
  endColumn?: number;

  /**
   * A memory reference to where the breakpoint is set.
   */
  instructionReference?: string;

  /**
   * The offset from the instruction reference.
   */
  offset?: number;
}

/**
 * Debug protocol source.
 */
export interface DebugProtocolSource {
  /**
   * The short name of the source.
   */
  name?: string;

  /**
   * The path of the source to be shown in the UI.
   */
  path?: string;

  /**
   * If the value > 0 the contents of the source must be retrieved through
   * the SourceRequest (even if a path is specified).
   */
  sourceReference?: number;

  /**
   * A hint for how to present the source in the UI.
   */
  presentationHint?: "normal" | "emphasize" | "deemphasize";

  /**
   * The origin of this source.
   */
  origin?: string;

  /**
   * An optional list of sources that are related to this source.
   */
  sources?: DebugProtocolSource[];

  /**
   * Additional data that a debug adapter might want to loop through the client.
   */
  adapterData?: unknown;

  /**
   * The checksums associated with this file.
   */
  checksums?: { algorithm: string; checksum: string }[];
}

/**
 * A debug adapter descriptor base.
 */
export interface DebugAdapterDescriptor {
  readonly type: "executable" | "server" | "namedPipeServer" | "inline";
}

/**
 * Represents a debug adapter running as an external process.
 */
export interface DebugAdapterExecutable extends DebugAdapterDescriptor {
  readonly type: "executable";
  readonly command: string;
  readonly args: string[];
  readonly options?: DebugAdapterExecutableOptions;
}

/**
 * Options for a debug adapter executable.
 */
export interface DebugAdapterExecutableOptions {
  /**
   * The environment of the executed debug adapter.
   */
  env?: { [key: string]: string };

  /**
   * The current working directory for the executed debug adapter.
   */
  cwd?: string;
}

/**
 * Represents a debug adapter running as a socket based server.
 */
export interface DebugAdapterServer extends DebugAdapterDescriptor {
  readonly type: "server";
  readonly port: number;
  readonly host?: string;
}

/**
 * Represents a debug adapter running as a named pipe based server.
 */
export interface DebugAdapterNamedPipeServer extends DebugAdapterDescriptor {
  readonly type: "namedPipeServer";
  readonly path: string;
}

/**
 * Represents a debug adapter that is implemented in the extension.
 */
export interface DebugAdapterInlineImplementation extends DebugAdapterDescriptor {
  readonly type: "inline";
  readonly implementation: DebugAdapter;
}

/**
 * A debug adapter interface.
 */
export interface DebugAdapter extends Disposable {
  readonly onDidSendMessage: Event<DebugProtocolMessage>;
  handleMessage(message: DebugProtocolMessage): void;
}

/**
 * Debug protocol message.
 */
export interface DebugProtocolMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * A debug adapter descriptor factory.
 */
export interface DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(
    session: DebugSession,
    executable: DebugAdapterExecutable | undefined
  ): Promise<DebugAdapterDescriptor | undefined> | DebugAdapterDescriptor | undefined;
}

/**
 * A debug adapter tracker factory.
 */
export interface DebugAdapterTrackerFactory {
  createDebugAdapterTracker(session: DebugSession): Promise<DebugAdapterTracker | undefined> | DebugAdapterTracker | undefined;
}

/**
 * A debug adapter tracker.
 */
export interface DebugAdapterTracker {
  /**
   * A session with the debug adapter is about to be started.
   */
  onWillStartSession?(): void;

  /**
   * The debug adapter is about to receive a Debug Adapter Protocol message from the editor.
   */
  onWillReceiveMessage?(message: unknown): void;

  /**
   * The debug adapter has sent a Debug Adapter Protocol message to the editor.
   */
  onDidSendMessage?(message: unknown): void;

  /**
   * The debug adapter session is about to be stopped.
   */
  onWillStopSession?(): void;

  /**
   * An error with the debug adapter has occurred.
   */
  onError?(error: Error): void;

  /**
   * The debug adapter has exited with the given exit code or signal.
   */
  onExit?(code: number | undefined, signal: string | undefined): void;
}

/**
 * Debug configuration provider.
 */
export interface DebugConfigurationProvider {
  /**
   * Provides initial debug configurations.
   */
  provideDebugConfigurations?(
    folder: { uri: Uri; name: string; index: number } | undefined,
    token?: CancellationToken
  ): Promise<DebugConfiguration[]> | DebugConfiguration[];

  /**
   * Resolves a debug configuration.
   */
  resolveDebugConfiguration?(
    folder: { uri: Uri; name: string; index: number } | undefined,
    debugConfiguration: DebugConfiguration,
    token?: CancellationToken
  ): Promise<DebugConfiguration | undefined | null> | DebugConfiguration | undefined | null;

  /**
   * Resolves a debug configuration with substituted variables.
   */
  resolveDebugConfigurationWithSubstitutedVariables?(
    folder: { uri: Uri; name: string; index: number } | undefined,
    debugConfiguration: DebugConfiguration,
    token?: CancellationToken
  ): Promise<DebugConfiguration | undefined | null> | DebugConfiguration | undefined | null;
}

/**
 * The trigger kind for debug configuration provider.
 */
export enum DebugConfigurationProviderTriggerKind {
  /**
   * `DebugConfigurationProvider.provideDebugConfigurations` is called to provide the initial
   * debug configurations for a newly created launch.json.
   */
  Initial = 1,

  /**
   * `DebugConfigurationProvider.provideDebugConfigurations` is called to provide
   * dynamically generated debug configurations when the user asks for them through the UI.
   */
  Dynamic = 2,
}

/**
 * Event for breakpoint changes.
 */
export interface BreakpointsChangeEvent {
  readonly added: readonly Breakpoint[];
  readonly removed: readonly Breakpoint[];
  readonly changed: readonly Breakpoint[];
}

/**
 * Debug console.
 */
export interface DebugConsole {
  /**
   * Append the given value to the debug console.
   */
  append(value: string): void;

  /**
   * Append the given value and a line feed character to the debug console.
   */
  appendLine(value: string): void;
}

/**
 * Thread information from debug adapter.
 */
export interface DebugThread {
  /**
   * The thread ID.
   */
  readonly id: number;

  /**
   * The name of the thread.
   */
  readonly name: string;
}

/**
 * Stack frame information from debug adapter.
 */
export interface DebugStackFrame {
  /**
   * The stack frame ID.
   */
  readonly id: number;

  /**
   * The name of the stack frame (typically the function name).
   */
  readonly name: string;

  /**
   * The source location.
   */
  readonly source?: DebugProtocolSource;

  /**
   * The line number (1-based).
   */
  readonly line: number;

  /**
   * The column number (1-based).
   */
  readonly column: number;

  /**
   * The end line number (1-based).
   */
  readonly endLine?: number;

  /**
   * The end column number (1-based).
   */
  readonly endColumn?: number;

  /**
   * Whether the frame can be restarted.
   */
  readonly canRestart?: boolean;

  /**
   * A presentation hint for how to show this frame.
   */
  readonly presentationHint?: "normal" | "label" | "subtle";
}

/**
 * Variable information from debug adapter.
 */
export interface DebugVariable {
  /**
   * The variable name.
   */
  readonly name: string;

  /**
   * The variable value as a string.
   */
  readonly value: string;

  /**
   * The type of the variable.
   */
  readonly type?: string;

  /**
   * Reference to get child variables.
   */
  readonly variablesReference: number;

  /**
   * Number of named child variables.
   */
  readonly namedVariables?: number;

  /**
   * Number of indexed child variables.
   */
  readonly indexedVariables?: number;

  /**
   * Evaluate name for use in expressions.
   */
  readonly evaluateName?: string;
}

/**
 * Scope information from debug adapter.
 */
export interface DebugScope {
  /**
   * The scope name.
   */
  readonly name: string;

  /**
   * Reference to get variables in this scope.
   */
  readonly variablesReference: number;

  /**
   * Whether this scope is expensive to retrieve.
   */
  readonly expensive: boolean;

  /**
   * A hint for how to present this scope.
   */
  readonly presentationHint?: string;

  /**
   * Source location of the scope.
   */
  readonly source?: DebugProtocolSource;

  /**
   * Start line of the scope.
   */
  readonly line?: number;

  /**
   * Start column of the scope.
   */
  readonly column?: number;

  /**
   * End line of the scope.
   */
  readonly endLine?: number;

  /**
   * End column of the scope.
   */
  readonly endColumn?: number;
}

// ============================================================================
// Debug API
// ============================================================================

/**
 * Debug namespace API (cortex.debug).
 *
 * Provides the complete debug API surface for extensions, bridging
 * to the DebugContext in the main thread.
 */
export interface DebugApi {
  // ============================================================================
  // Properties
  // ============================================================================

  /**
   * The currently active debug session or `undefined`.
   * This is the session that currently has focus in the debugger UI.
   */
  readonly activeDebugSession: DebugSession | undefined;

  /**
   * The currently active debug console.
   * Extensions can write to this console to display debug-related messages.
   */
  readonly activeDebugConsole: DebugConsole;

  /**
   * All breakpoints across all files and types.
   * Includes source breakpoints, function breakpoints, and data breakpoints.
   */
  readonly breakpoints: readonly Breakpoint[];

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Event emitted when the active debug session has changed.
   * Fires when a different session becomes active or when debugging stops.
   */
  readonly onDidChangeActiveDebugSession: Event<DebugSession | undefined>;

  /**
   * Event emitted when a new debug session has been started.
   * This fires after the debug adapter has been initialized.
   */
  readonly onDidStartDebugSession: Event<DebugSession>;

  /**
   * Event emitted when a debug session has received a custom event from the debug adapter.
   * Custom events are adapter-specific and can be used for extension-specific features.
   */
  readonly onDidReceiveDebugSessionCustomEvent: Event<DebugSessionCustomEvent>;

  /**
   * Event emitted when a debug session has terminated.
   * This fires when the debug session ends, either normally or due to an error.
   */
  readonly onDidTerminateDebugSession: Event<DebugSession>;

  /**
   * Event emitted when the set of breakpoints is added, removed, or changed.
   * Provides detailed information about which breakpoints were affected.
   */
  readonly onDidChangeBreakpoints: Event<BreakpointsChangeEvent>;

  // ============================================================================
  // Registration Methods
  // ============================================================================

  /**
   * Register a debug configuration provider.
   *
   * A debug configuration provider allows extensions to:
   * - Provide initial debug configurations for launch.json
   * - Resolve/modify debug configurations before launching
   * - Dynamically generate debug configurations
   *
   * @param debugType The debug type (e.g., "node", "python", "lldb")
   * @param provider The configuration provider implementation
   * @param triggerKind When the provider should be triggered (Initial or Dynamic)
   * @returns A disposable to unregister the provider
   */
  registerDebugConfigurationProvider(
    debugType: string,
    provider: DebugConfigurationProvider,
    triggerKind?: DebugConfigurationProviderTriggerKind
  ): Disposable;

  /**
   * Register a debug adapter descriptor factory.
   *
   * This allows extensions to control how the debug adapter is started:
   * - As an executable process
   * - Connected via socket
   * - As an inline implementation
   *
   * @param debugType The debug type this factory handles
   * @param factory The factory implementation
   * @returns A disposable to unregister the factory
   */
  registerDebugAdapterDescriptorFactory(
    debugType: string,
    factory: DebugAdapterDescriptorFactory
  ): Disposable;

  /**
   * Register a debug adapter tracker factory.
   *
   * Debug adapter trackers intercept communication between the editor
   * and the debug adapter, useful for logging, telemetry, or debugging
   * the debug adapter itself.
   *
   * @param debugType The debug type to track ("*" for all types)
   * @param factory The tracker factory implementation
   * @returns A disposable to unregister the factory
   */
  registerDebugAdapterTrackerFactory(
    debugType: string,
    factory: DebugAdapterTrackerFactory
  ): Disposable;

  // ============================================================================
  // Session Control
  // ============================================================================

  /**
   * Start a debug session.
   *
   * @param folder The workspace folder for the session, or undefined for folderless
   * @param nameOrConfiguration Either a configuration name from launch.json or a full configuration object
   * @param parentSessionOrOptions Parent session or session options
   * @returns true if debugging was started successfully, false otherwise
   *
   * @example
   * // Start with a named configuration
   * await cortex.debug.startDebugging(folder, "Launch Program");
   *
   * @example
   * // Start with an inline configuration
   * await cortex.debug.startDebugging(folder, {
   *   type: "node",
   *   name: "Debug Current File",
   *   request: "launch",
   *   program: "${file}"
   * });
   */
  startDebugging(
    folder: { uri: Uri; name: string; index: number } | undefined,
    nameOrConfiguration: string | DebugConfiguration,
    parentSessionOrOptions?: DebugSession | DebugSessionOptions
  ): Promise<boolean>;

  /**
   * Stop debugging.
   *
   * @param session The session to stop, or undefined to stop all sessions
   *
   * @example
   * // Stop the active session
   * await cortex.debug.stopDebugging();
   *
   * @example
   * // Stop a specific session
   * await cortex.debug.stopDebugging(mySession);
   */
  stopDebugging(session?: DebugSession): Promise<void>;

  // ============================================================================
  // Breakpoint Management
  // ============================================================================

  /**
   * Add breakpoints.
   *
   * The breakpoints are merged with existing ones. To update a breakpoint,
   * remove it first and then add the modified version.
   *
   * @param breakpoints Array of breakpoints to add
   *
   * @example
   * cortex.debug.addBreakpoints([{
   *   id: "bp1",
   *   enabled: true,
   *   location: {
   *     uri: cortex.Uri.file("/path/to/file.ts"),
   *     range: new cortex.Range(10, 0, 10, 0)
   *   }
   * }]);
   */
  addBreakpoints(breakpoints: Breakpoint[]): void;

  /**
   * Remove breakpoints.
   *
   * @param breakpoints Array of breakpoints to remove (matched by id)
   */
  removeBreakpoints(breakpoints: Breakpoint[]): void;

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Converts a "Source" descriptor object received via the Debug Adapter Protocol
   * into a Uri that can be used to load its contents.
   *
   * This is useful for opening source files referenced by the debug adapter,
   * especially for source references (in-memory sources from the adapter).
   *
   * @param source The DAP source object
   * @param session Optional session context for source references
   * @returns A Uri that can be used to open/load the source
   */
  asDebugSourceUri(source: DebugProtocolSource, session?: DebugSession): Uri;
}

/**
 * Debug session custom event.
 */
export interface DebugSessionCustomEvent {
  readonly session: DebugSession;
  readonly event: string;
  readonly body?: unknown;
}

/**
 * Evaluate result from debug adapter.
 */
export interface DebugEvaluateResult {
  /**
   * The result string.
   */
  readonly result: string;

  /**
   * The type of the result.
   */
  readonly type?: string;

  /**
   * Reference to get child variables (for expandable results).
   */
  readonly variablesReference: number;

  /**
   * Number of named child variables.
   */
  readonly namedVariables?: number;

  /**
   * Number of indexed child variables.
   */
  readonly indexedVariables?: number;

  /**
   * Memory reference if available.
   */
  readonly memoryReference?: string;
}

/**
 * Capabilities reported by debug adapter.
 */
export interface DebugCapabilities {
  /**
   * Whether the adapter supports stepping backwards.
   */
  readonly supportsStepBack?: boolean;

  /**
   * Whether the adapter supports reverse continue.
   */
  readonly supportsReverseContinue?: boolean;

  /**
   * Whether the adapter supports restarting frames.
   */
  readonly supportsRestartFrame?: boolean;

  /**
   * Whether the adapter supports restarting the session.
   */
  readonly supportsRestartRequest?: boolean;

  /**
   * Whether the adapter supports setting variables.
   */
  readonly supportsSetVariable?: boolean;

  /**
   * Whether the adapter supports completions.
   */
  readonly supportsCompletionsRequest?: boolean;

  /**
   * Whether the adapter supports disassembly.
   */
  readonly supportsDisassembleRequest?: boolean;

  /**
   * Whether the adapter supports reading memory.
   */
  readonly supportsReadMemoryRequest?: boolean;

  /**
   * Whether the adapter supports writing memory.
   */
  readonly supportsWriteMemoryRequest?: boolean;

  /**
   * Whether the adapter supports data breakpoints.
   */
  readonly supportsDataBreakpoints?: boolean;

  /**
   * Whether the adapter supports step-in targets.
   */
  readonly supportsStepInTargetsRequest?: boolean;

  /**
   * Whether the adapter supports goto targets.
   */
  readonly supportsGotoTargetsRequest?: boolean;

  /**
   * Whether the adapter supports function breakpoints.
   */
  readonly supportsFunctionBreakpoints?: boolean;

  /**
   * Whether the adapter supports conditional breakpoints.
   */
  readonly supportsConditionalBreakpoints?: boolean;

  /**
   * Whether the adapter supports hit conditional breakpoints.
   */
  readonly supportsHitConditionalBreakpoints?: boolean;

  /**
   * Whether the adapter supports logpoints.
   */
  readonly supportsLogPoints?: boolean;

  /**
   * Whether the adapter supports instruction breakpoints.
   */
  readonly supportsInstructionBreakpoints?: boolean;

  /**
   * Whether the adapter supports exception info.
   */
  readonly supportsExceptionInfoRequest?: boolean;

  /**
   * Whether the adapter supports exception options.
   */
  readonly supportsExceptionOptions?: boolean;

  /**
   * Exception breakpoint filters supported by the adapter.
   */
  readonly exceptionBreakpointFilters?: ExceptionBreakpointFilter[];
}

/**
 * Exception breakpoint filter definition.
 */
export interface ExceptionBreakpointFilter {
  /**
   * The internal ID of the filter.
   */
  readonly filter: string;

  /**
   * The display label for the filter.
   */
  readonly label: string;

  /**
   * Optional description of the filter.
   */
  readonly description?: string;

  /**
   * Whether this filter is enabled by default.
   */
  readonly default?: boolean;

  /**
   * Whether the filter supports conditions.
   */
  readonly supportsCondition?: boolean;

  /**
   * Description of the condition format.
   */
  readonly conditionDescription?: string;
}

/**
 * Step-in target information.
 */
export interface StepInTarget {
  /**
   * Unique identifier for the target.
   */
  readonly id: number;

  /**
   * The name of the target (typically function name).
   */
  readonly label: string;

  /**
   * Line number where the target begins.
   */
  readonly line?: number;

  /**
   * Column number where the target begins.
   */
  readonly column?: number;

  /**
   * End line of the target.
   */
  readonly endLine?: number;

  /**
   * End column of the target.
   */
  readonly endColumn?: number;
}

/**
 * Goto target information.
 */
export interface GotoTarget {
  /**
   * Unique identifier for the target.
   */
  readonly id: number;

  /**
   * The display label.
   */
  readonly label: string;

  /**
   * Line number of the target.
   */
  readonly line: number;

  /**
   * Column number of the target.
   */
  readonly column?: number;

  /**
   * End line of the target.
   */
  readonly endLine?: number;

  /**
   * End column of the target.
   */
  readonly endColumn?: number;

  /**
   * Instruction pointer reference.
   */
  readonly instructionPointerReference?: string;
}

/**
 * Internal state for tracking debug sessions and breakpoints.
 */
interface DebugApiState {
  activeSession: DebugSession | undefined;
  sessions: Map<string, DebugSession>;
  breakpoints: Breakpoint[];
  configurationProviders: Map<string, DebugConfigurationProvider[]>;
  descriptorFactories: Map<string, DebugAdapterDescriptorFactory>;
  trackerFactories: Map<string, DebugAdapterTrackerFactory[]>;
}

/**
 * Create the debug API (cortex.debug).
 *
 * This function creates the debug namespace that is exposed to extensions.
 * It bridges extension API calls to the DebugContext running in the main thread
 * via the ExtensionApiBridge IPC mechanism.
 *
 * The API is designed to be compatible with VS Code's vscode.debug namespace
 * to allow extension authors to write cross-compatible extensions.
 *
 * @param extensionId The unique identifier of the extension using this API
 * @param bridge The IPC bridge for communicating with the main thread
 * @param disposables Store for managing disposable resources
 * @returns The debug API object
 */
export function createDebugApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): DebugApi {
  // Internal state management
  const state: DebugApiState = {
    activeSession: undefined,
    sessions: new Map(),
    breakpoints: [],
    configurationProviders: new Map(),
    descriptorFactories: new Map(),
    trackerFactories: new Map(),
  };

  // Event emitters for the API
  const onDidChangeActiveDebugSessionEmitter = new EventEmitter<DebugSession | undefined>();
  const onDidStartDebugSessionEmitter = new EventEmitter<DebugSession>();
  const onDidReceiveDebugSessionCustomEventEmitter = new EventEmitter<DebugSessionCustomEvent>();
  const onDidTerminateDebugSessionEmitter = new EventEmitter<DebugSession>();
  const onDidChangeBreakpointsEmitter = new EventEmitter<BreakpointsChangeEvent>();

  // Register emitters for cleanup
  disposables.add(onDidChangeActiveDebugSessionEmitter);
  disposables.add(onDidStartDebugSessionEmitter);
  disposables.add(onDidReceiveDebugSessionCustomEventEmitter);
  disposables.add(onDidTerminateDebugSessionEmitter);
  disposables.add(onDidChangeBreakpointsEmitter);

  // ============================================================================
  // Event Subscriptions from Main Thread (DebugContext)
  // ============================================================================

  // Session started - creates a new debug session and fires event
  disposables.add(
    bridge.subscribeEvent("debug.sessionStarted", (data) => {
      const sessionData = data as {
        id: string;
        type: string;
        name: string;
        configuration: DebugConfiguration;
        workspaceFolder?: { uri: string; name: string; index: number };
        parentSessionId?: string;
      };
      const session = createDebugSessionProxy(sessionData, bridge, extensionId, state.sessions);
      state.sessions.set(session.id, session);
      state.activeSession = session;
      onDidStartDebugSessionEmitter.fire(session);
      onDidChangeActiveDebugSessionEmitter.fire(session);
    })
  );

  // Session terminated - removes session and fires events
  disposables.add(
    bridge.subscribeEvent("debug.sessionTerminated", (data) => {
      const { id } = data as { id: string };
      const session = state.sessions.get(id);
      if (session) {
        state.sessions.delete(id);
        if (state.activeSession?.id === id) {
          // Set next session as active, or undefined if none
          state.activeSession = state.sessions.size > 0
            ? state.sessions.values().next().value
            : undefined;
          onDidChangeActiveDebugSessionEmitter.fire(state.activeSession);
        }
        onDidTerminateDebugSessionEmitter.fire(session);
      }
    })
  );

  // Active session changed
  disposables.add(
    bridge.subscribeEvent("debug.activeSessionChanged", (data) => {
      const { id } = data as { id: string | null };
      state.activeSession = id ? state.sessions.get(id) : undefined;
      onDidChangeActiveDebugSessionEmitter.fire(state.activeSession);
    })
  );

  // Custom event from debug adapter
  disposables.add(
    bridge.subscribeEvent("debug.customEvent", (data) => {
      const { sessionId, event, body } = data as {
        sessionId: string;
        event: string;
        body?: unknown;
      };
      const session = state.sessions.get(sessionId);
      if (session) {
        onDidReceiveDebugSessionCustomEventEmitter.fire({ session, event, body });
      }
    })
  );

  // Breakpoints changed - update local cache and fire event
  disposables.add(
    bridge.subscribeEvent("debug.breakpointsChanged", (data) => {
      const event = data as BreakpointsChangeEvent;

      // Update local breakpoints cache
      for (const bp of event.removed) {
        const index = state.breakpoints.findIndex((b) => b.id === bp.id);
        if (index >= 0) {
          state.breakpoints.splice(index, 1);
        }
      }

      for (const bp of event.added) {
        state.breakpoints.push(bp);
      }

      for (const bp of event.changed) {
        const index = state.breakpoints.findIndex((b) => b.id === bp.id);
        if (index >= 0) {
          state.breakpoints[index] = bp;
        }
      }

      onDidChangeBreakpointsEmitter.fire(event);
    })
  );

  // Initial breakpoints sync
  disposables.add(
    bridge.subscribeEvent("debug.breakpointsSync", (data) => {
      const { breakpoints } = data as { breakpoints: Breakpoint[] };
      state.breakpoints = breakpoints;
    })
  );

  // Request initial state from main thread
  bridge.callMainThread(extensionId, "debug", "syncState", []).then((data) => {
    const syncData = data as {
      activeSessionId?: string;
      sessions?: Array<{
        id: string;
        type: string;
        name: string;
        configuration: DebugConfiguration;
        workspaceFolder?: { uri: string; name: string; index: number };
      }>;
      breakpoints?: Breakpoint[];
    } | undefined;

    if (syncData) {
      // Initialize sessions
      for (const sessionData of syncData.sessions ?? []) {
        const session = createDebugSessionProxy(sessionData, bridge, extensionId, state.sessions);
        state.sessions.set(session.id, session);
      }

      // Set active session
      if (syncData.activeSessionId) {
        state.activeSession = state.sessions.get(syncData.activeSessionId);
      }

      // Initialize breakpoints
      if (syncData.breakpoints) {
        state.breakpoints = syncData.breakpoints;
      }
    }
  }).catch((e) => {
    console.warn(`[Debug API] Failed to sync initial state: ${e}`);
  });

  // ============================================================================
  // Debug Console Implementation
  // ============================================================================

  const debugConsole: DebugConsole = {
    append(value: string): void {
      bridge.callMainThread(extensionId, "debug", "consoleAppend", [value]);
    },
    appendLine(value: string): void {
      bridge.callMainThread(extensionId, "debug", "consoleAppend", [value + "\n"]);
    },
  };

  // ============================================================================
  // Return the Debug API Object
  // ============================================================================

  return {
    // Properties
    get activeDebugSession(): DebugSession | undefined {
      return state.activeSession;
    },

    get activeDebugConsole(): DebugConsole {
      return debugConsole;
    },

    get breakpoints(): readonly Breakpoint[] {
      return state.breakpoints;
    },

    // Events
    onDidChangeActiveDebugSession: onDidChangeActiveDebugSessionEmitter.event,
    onDidStartDebugSession: onDidStartDebugSessionEmitter.event,
    onDidReceiveDebugSessionCustomEvent: onDidReceiveDebugSessionCustomEventEmitter.event,
    onDidTerminateDebugSession: onDidTerminateDebugSessionEmitter.event,
    onDidChangeBreakpoints: onDidChangeBreakpointsEmitter.event,

    // Registration methods
    registerDebugConfigurationProvider(
      debugType: string,
      provider: DebugConfigurationProvider,
      triggerKind: DebugConfigurationProviderTriggerKind = DebugConfigurationProviderTriggerKind.Initial
    ): Disposable {
      const providerId = `${extensionId}.debugConfig.${debugType}.${crypto.randomUUID()}`;

      // Store provider locally
      if (!state.configurationProviders.has(debugType)) {
        state.configurationProviders.set(debugType, []);
      }
      state.configurationProviders.get(debugType)!.push(provider);

      // Register with main thread
      bridge.callMainThread(extensionId, "debug", "registerConfigurationProvider", [
        providerId,
        debugType,
        triggerKind,
        {
          hasProvideMethod: typeof provider.provideDebugConfigurations === "function",
          hasResolveMethod: typeof provider.resolveDebugConfiguration === "function",
          hasResolveWithSubstitutionMethod:
            typeof provider.resolveDebugConfigurationWithSubstitutedVariables === "function",
        },
      ]);

      // Handle provide configurations request
      const provideConfigsSub = bridge.subscribeEvent(
        `debug.${providerId}.provideConfigurations`,
        async (data) => {
          const { requestId, folder, token } = data as {
            requestId: string;
            folder: { uri: string; name: string; index: number } | null;
            token?: CancellationToken;
          };
          try {
            const workspaceFolder = folder
              ? { uri: createUri(folder.uri), name: folder.name, index: folder.index }
              : undefined;
            const configs = await provider.provideDebugConfigurations?.(workspaceFolder, token);
            bridge.callMainThread(extensionId, "debug", "configurationProviderResponse", [
              requestId,
              configs ?? [],
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "debug", "configurationProviderResponse", [
              requestId,
              [],
              String(error),
            ]);
          }
        }
      );

      // Handle resolve configuration request
      const resolveConfigSub = bridge.subscribeEvent(
        `debug.${providerId}.resolveConfiguration`,
        async (data) => {
          const { requestId, folder, config, token } = data as {
            requestId: string;
            folder: { uri: string; name: string; index: number } | null;
            config: DebugConfiguration;
            token?: CancellationToken;
          };
          try {
            const workspaceFolder = folder
              ? { uri: createUri(folder.uri), name: folder.name, index: folder.index }
              : undefined;
            const resolved = await provider.resolveDebugConfiguration?.(workspaceFolder, config, token);
            bridge.callMainThread(extensionId, "debug", "resolveConfigurationResponse", [
              requestId,
              resolved,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "debug", "resolveConfigurationResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      // Handle resolve configuration with substituted variables request
      const resolveSubstitutedSub = bridge.subscribeEvent(
        `debug.${providerId}.resolveConfigurationWithSubstitution`,
        async (data) => {
          const { requestId, folder, config, token } = data as {
            requestId: string;
            folder: { uri: string; name: string; index: number } | null;
            config: DebugConfiguration;
            token?: CancellationToken;
          };
          try {
            const workspaceFolder = folder
              ? { uri: createUri(folder.uri), name: folder.name, index: folder.index }
              : undefined;
            const resolved = await provider.resolveDebugConfigurationWithSubstitutedVariables?.(
              workspaceFolder,
              config,
              token
            );
            bridge.callMainThread(extensionId, "debug", "resolveConfigurationResponse", [
              requestId,
              resolved,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "debug", "resolveConfigurationResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        provideConfigsSub.dispose();
        resolveConfigSub.dispose();
        resolveSubstitutedSub.dispose();

        // Remove from local cache
        const providers = state.configurationProviders.get(debugType);
        if (providers) {
          const index = providers.indexOf(provider);
          if (index >= 0) {
            providers.splice(index, 1);
          }
        }

        bridge.callMainThread(extensionId, "debug", "unregisterConfigurationProvider", [providerId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerDebugAdapterDescriptorFactory(
      debugType: string,
      factory: DebugAdapterDescriptorFactory
    ): Disposable {
      const factoryId = `${extensionId}.debugAdapter.${debugType}`;

      // Only one factory per debug type per extension
      if (state.descriptorFactories.has(debugType)) {
        throw new Error(`Debug adapter descriptor factory for type '${debugType}' already registered by this extension`);
      }
      state.descriptorFactories.set(debugType, factory);

      // Register with main thread
      bridge.callMainThread(extensionId, "debug", "registerAdapterDescriptorFactory", [
        factoryId,
        debugType,
      ]);

      // Handle create descriptor request
      const sub = bridge.subscribeEvent(
        `debug.${factoryId}.createDescriptor`,
        async (data) => {
          const { requestId, session, executable } = data as {
            requestId: string;
            session: {
              id: string;
              type: string;
              name: string;
              configuration: DebugConfiguration;
              workspaceFolder?: { uri: string; name: string; index: number };
            };
            executable: DebugAdapterExecutable | undefined;
          };
          try {
            const debugSession = createDebugSessionProxy(session, bridge, extensionId, state.sessions);
            const descriptor = await factory.createDebugAdapterDescriptor(debugSession, executable);
            bridge.callMainThread(extensionId, "debug", "adapterDescriptorResponse", [
              requestId,
              serializeAdapterDescriptor(descriptor),
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "debug", "adapterDescriptorResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        sub.dispose();
        state.descriptorFactories.delete(debugType);
        bridge.callMainThread(extensionId, "debug", "unregisterAdapterDescriptorFactory", [factoryId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    registerDebugAdapterTrackerFactory(
      debugType: string,
      factory: DebugAdapterTrackerFactory
    ): Disposable {
      const factoryId = `${extensionId}.debugTracker.${debugType}.${crypto.randomUUID()}`;

      // Store factory locally
      if (!state.trackerFactories.has(debugType)) {
        state.trackerFactories.set(debugType, []);
      }
      state.trackerFactories.get(debugType)!.push(factory);

      // Register with main thread
      bridge.callMainThread(extensionId, "debug", "registerAdapterTrackerFactory", [
        factoryId,
        debugType,
      ]);

      // Track active trackers keyed by session ID
      const activeTrackers = new Map<string, DebugAdapterTracker>();

      // Handle create tracker request
      const createSub = bridge.subscribeEvent(
        `debug.${factoryId}.createTracker`,
        async (data) => {
          const { requestId, session } = data as {
            requestId: string;
            session: {
              id: string;
              type: string;
              name: string;
              configuration: DebugConfiguration;
            };
          };
          try {
            const debugSession = createDebugSessionProxy(session, bridge, extensionId, state.sessions);
            const tracker = await factory.createDebugAdapterTracker(debugSession);

            if (tracker) {
              activeTrackers.set(session.id, tracker);
              bridge.callMainThread(extensionId, "debug", "adapterTrackerResponse", [
                requestId,
                true,
              ]);
            } else {
              bridge.callMainThread(extensionId, "debug", "adapterTrackerResponse", [
                requestId,
                false,
              ]);
            }
          } catch (error) {
            bridge.callMainThread(extensionId, "debug", "adapterTrackerResponse", [
              requestId,
              false,
              String(error),
            ]);
          }
        }
      );

      // Forward tracker lifecycle events
      const willStartSub = bridge.subscribeEvent(
        `debug.${factoryId}.onWillStartSession`,
        (data) => {
          const { sessionId } = data as { sessionId: string };
          activeTrackers.get(sessionId)?.onWillStartSession?.();
        }
      );

      const willReceiveSub = bridge.subscribeEvent(
        `debug.${factoryId}.onWillReceiveMessage`,
        (data) => {
          const { sessionId, message } = data as { sessionId: string; message: unknown };
          activeTrackers.get(sessionId)?.onWillReceiveMessage?.(message);
        }
      );

      const didSendSub = bridge.subscribeEvent(
        `debug.${factoryId}.onDidSendMessage`,
        (data) => {
          const { sessionId, message } = data as { sessionId: string; message: unknown };
          activeTrackers.get(sessionId)?.onDidSendMessage?.(message);
        }
      );

      const willStopSub = bridge.subscribeEvent(
        `debug.${factoryId}.onWillStopSession`,
        (data) => {
          const { sessionId } = data as { sessionId: string };
          activeTrackers.get(sessionId)?.onWillStopSession?.();
          activeTrackers.delete(sessionId);
        }
      );

      const errorSub = bridge.subscribeEvent(
        `debug.${factoryId}.onError`,
        (data) => {
          const { sessionId, error } = data as { sessionId: string; error: string };
          activeTrackers.get(sessionId)?.onError?.(new Error(error));
        }
      );

      const exitSub = bridge.subscribeEvent(
        `debug.${factoryId}.onExit`,
        (data) => {
          const { sessionId, code, signal } = data as {
            sessionId: string;
            code?: number;
            signal?: string;
          };
          activeTrackers.get(sessionId)?.onExit?.(code, signal);
          activeTrackers.delete(sessionId);
        }
      );

      const disposable = createDisposable(() => {
        createSub.dispose();
        willStartSub.dispose();
        willReceiveSub.dispose();
        didSendSub.dispose();
        willStopSub.dispose();
        errorSub.dispose();
        exitSub.dispose();

        activeTrackers.clear();

        // Remove from local cache
        const factories = state.trackerFactories.get(debugType);
        if (factories) {
          const index = factories.indexOf(factory);
          if (index >= 0) {
            factories.splice(index, 1);
          }
        }

        bridge.callMainThread(extensionId, "debug", "unregisterAdapterTrackerFactory", [factoryId]);
      });

      disposables.add(disposable);
      return disposable;
    },

    // Session control
    async startDebugging(
      folder: { uri: Uri; name: string; index: number } | undefined,
      nameOrConfiguration: string | DebugConfiguration,
      parentSessionOrOptions?: DebugSession | DebugSessionOptions
    ): Promise<boolean> {
      // Normalize options
      let options: DebugSessionOptions | undefined;
      if (parentSessionOrOptions) {
        if ("id" in parentSessionOrOptions) {
          options = { parentSession: parentSessionOrOptions };
        } else {
          options = parentSessionOrOptions;
        }
      }

      // Serialize folder for IPC
      const serializedFolder = folder
        ? { uri: folder.uri.toString(), name: folder.name, index: folder.index }
        : null;

      // Serialize options for IPC
      const serializedOptions = options
        ? {
            ...options,
            parentSessionId: options.parentSession?.id,
            parentSession: undefined, // Don't send the full session object
          }
        : undefined;

      return bridge.callMainThread<boolean>(extensionId, "debug", "startDebugging", [
        serializedFolder,
        nameOrConfiguration,
        serializedOptions,
      ]);
    },

    async stopDebugging(session?: DebugSession): Promise<void> {
      await bridge.callMainThread(extensionId, "debug", "stopDebugging", [session?.id ?? null]);
    },

    // Breakpoint management
    addBreakpoints(breakpoints: Breakpoint[]): void {
      // Serialize breakpoints for IPC
      const serialized = breakpoints.map(serializeBreakpoint);
      bridge.callMainThread(extensionId, "debug", "addBreakpoints", [serialized]);
    },

    removeBreakpoints(breakpoints: Breakpoint[]): void {
      const ids = breakpoints.map((bp) => bp.id);
      bridge.callMainThread(extensionId, "debug", "removeBreakpoints", [ids]);
    },

    // Utility methods
    asDebugSourceUri(source: DebugProtocolSource, session?: DebugSession): Uri {
      if (source.path) {
        return createUri(source.path);
      }

      // For source references (in-memory sources from debug adapter)
      if (source.sourceReference && source.sourceReference > 0) {
        const sessionId = session?.id ?? state.activeSession?.id ?? "";
        return createUri(`debug:${sessionId}/${source.sourceReference}/${source.name ?? "source"}`);
      }

      return createUri(`untitled:${source.name ?? "unknown"}`);
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a debug session proxy object.
 *
 * This creates a DebugSession object that proxies method calls to the main thread
 * via the bridge.
 */
function createDebugSessionProxy(
  data: {
    id: string;
    type: string;
    name: string;
    configuration: DebugConfiguration;
    workspaceFolder?: { uri: string; name: string; index: number };
    parentSessionId?: string;
  },
  bridge: ExtensionApiBridge,
  extensionId: string,
  sessionsMap: Map<string, DebugSession>
): DebugSession {
  // Resolve workspace folder URI if present
  const workspaceFolder = data.workspaceFolder
    ? {
        uri: createUri(data.workspaceFolder.uri),
        name: data.workspaceFolder.name,
        index: data.workspaceFolder.index,
      }
    : undefined;

  // Create the session proxy
  const session: DebugSession = {
    id: data.id,
    type: data.type,
    name: data.name,
    workspaceFolder,
    configuration: data.configuration,

    // Parent session is resolved lazily from the sessions map
    get parentSession(): DebugSession | undefined {
      return data.parentSessionId ? sessionsMap.get(data.parentSessionId) : undefined;
    },

    async customRequest(command: string, args?: unknown): Promise<unknown> {
      return bridge.callMainThread(extensionId, "debug", "customRequest", [
        data.id,
        command,
        args,
      ]);
    },

    async getDebugProtocolBreakpoint(
      breakpoint: Breakpoint
    ): Promise<DebugProtocolBreakpoint | undefined> {
      return bridge.callMainThread<DebugProtocolBreakpoint | undefined>(
        extensionId,
        "debug",
        "getDebugProtocolBreakpoint",
        [data.id, breakpoint.id]
      );
    },
  };

  return session;
}

/**
 * Serialize a breakpoint for IPC transmission.
 */
function serializeBreakpoint(bp: Breakpoint): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: bp.id,
    enabled: bp.enabled,
    condition: bp.condition,
    hitCondition: bp.hitCondition,
    logMessage: bp.logMessage,
  };

  // Check for SourceBreakpoint
  if ("location" in bp && (bp as SourceBreakpoint).location) {
    const sourceBp = bp as SourceBreakpoint;
    return {
      ...base,
      type: "source",
      uri: sourceBp.location.uri.toString(),
      line: sourceBp.location.range.start.line,
      character: sourceBp.location.range.start.character,
      endLine: sourceBp.location.range.end.line,
      endCharacter: sourceBp.location.range.end.character,
    };
  }

  // Check for FunctionBreakpoint
  if ("functionName" in bp && (bp as FunctionBreakpoint).functionName) {
    const funcBp = bp as FunctionBreakpoint;
    return {
      ...base,
      type: "function",
      functionName: funcBp.functionName,
    };
  }

  // Check for DataBreakpoint
  if ("dataId" in bp && (bp as DataBreakpoint).dataId) {
    const dataBp = bp as DataBreakpoint;
    return {
      ...base,
      type: "data",
      label: dataBp.label,
      dataId: dataBp.dataId,
      accessType: dataBp.accessType,
      canPersist: dataBp.canPersist,
    };
  }

  // Check for InstructionBreakpoint
  if ("instructionReference" in bp && (bp as InstructionBreakpoint).instructionReference) {
    const instrBp = bp as InstructionBreakpoint;
    return {
      ...base,
      type: "instruction",
      instructionReference: instrBp.instructionReference,
      offset: instrBp.offset,
    };
  }

  // Generic breakpoint
  return base;
}

/**
 * Serialize a debug adapter descriptor for IPC transmission.
 */
function serializeAdapterDescriptor(
  descriptor: DebugAdapterDescriptor | undefined
): Record<string, unknown> | null {
  if (!descriptor) {
    return null;
  }

  switch (descriptor.type) {
    case "executable": {
      const exec = descriptor as DebugAdapterExecutable;
      return {
        type: "executable",
        command: exec.command,
        args: exec.args,
        options: exec.options,
      };
    }
    case "server": {
      const server = descriptor as DebugAdapterServer;
      return {
        type: "server",
        port: server.port,
        host: server.host,
      };
    }
    case "namedPipeServer": {
      const pipe = descriptor as DebugAdapterNamedPipeServer;
      return {
        type: "namedPipeServer",
        path: pipe.path,
      };
    }
    case "inline": {
      // Inline implementations can't be serialized, but we signal their presence
      return {
        type: "inline",
        // The actual implementation stays in the extension host
      };
    }
    default:
      return null;
  }
}

// Note: All interfaces, types, and enums are already exported at their definitions above
// Note: createDebugApi is already exported at its function definition
