/**
 * @fileoverview Cortex TypeScript SDK
 * 
 * A comprehensive TypeScript SDK for interacting with the Cortex CLI.
 * This SDK provides type-safe methods for all CLI commands, streaming
 * support, error handling, and multi-environment execution (Node.js, Tauri).
 * 
 * @module @cortex/sdk
 * @author Cortex Team
 * @license Apache-2.0
 * @version 1.0.0
 * 
 * @example Basic Usage
 * ```typescript
 * import { CortexClient } from '@cortex/sdk';
 * 
 * const client = new CortexClient();
 * 
 * // Simple exec
 * const result = await client.exec('Write a hello world function');
 * console.log(result.data);
 * 
 * // Streaming exec
 * const stream = client.execStream('Refactor main.ts', {
 *   onEvent: (event) => {
 *     if (event.type === 'agent_message_delta') {
 *       process.stdout.write(event.data.delta);
 *     }
 *   },
 * });
 * await stream.wait();
 * ```
 * 
 * @example With Options
 * ```typescript
 * import { CortexClient, AutonomyLevel } from '@cortex/sdk';
 * 
 * const client = new CortexClient({
 *   defaultModel: 'claude-sonnet-4-20250514',
 *   defaultAutonomy: AutonomyLevel.Medium,
 *   cwd: '/path/to/project',
 * });
 * 
 * const result = await client.exec('Run tests and fix failures', {
 *   maxTurns: 50,
 *   timeout: 300,
 * });
 * ```
 * 
 * @example Error Handling
 * ```typescript
 * import { CortexClient, RateLimitError, withRetry } from '@cortex/sdk';
 * 
 * const client = new CortexClient();
 * 
 * try {
 *   const result = await withRetry(
 *     () => client.exec('Complex task'),
 *     { maxAttempts: 3 }
 *   );
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     console.log(`Rate limited. Retry after ${error.retryAfterSeconds}s`);
 *   }
 *   throw error;
 * }
 * ```
 */

// ============================================================================
// Main Client Export
// ============================================================================

export { 
  CortexClient, 
  createClient,
  type CortexClientConfig,
  type VersionInfo,
  type ExecJsonResult,
  type RunJsonResult,
  type ModelListResponse,
  type ExecStreamOptions,
  type CreateAgentOptions,
  type McpServerInfo,
  type WhoamiResponse,
  type StatsResponse,
  type GitHubWorkflow,
  type DiagnosticsResult,
  type DiagnosticIssue,
  type ClearCacheResult,
  type CacheStatsResult,
} from "./client";

export { default } from "./client";

// ============================================================================
// Executor Export
// ============================================================================

export {
  CliExecutor,
  type CliExecutorOptions,
  type ExecutionOptions,
  type StreamExecutionOptions,
  type ProcessRunner,
  type ProcessOptions,
  type ProcessResult,
  type ProcessHandle,
  StreamHandle,
  JsonStreamHandle,
  NodeProcessRunner,
  TauriProcessRunner,
  detectEnvironment,
  type ExecutionEnvironment,
  getDefaultExecutor,
  setDefaultExecutor,
} from "./executor";

// ============================================================================
// Types Export
// ============================================================================

export type {
  // Core identifiers
  ConversationId,
  CallId,
  MessageId,
  
  // Autonomy and permissions
  SandboxPolicy,
  
  // Events
  Event,
  EventMsg,
  SessionConfiguredEvent,
  TaskStartedEvent,
  TaskCompleteEvent,
  TurnAbortedEvent,
  ErrorEvent,
  WarningEvent,
  StreamErrorEvent,
  AgentMessageEvent,
  AgentMessageDeltaEvent,
  UserMessageEvent,
  AgentReasoningEvent,
  AgentReasoningDeltaEvent,
  ExecCommandBeginEvent,
  ExecCommandOutputDeltaEvent,
  ExecCommandEndEvent,
  ExecApprovalRequestEvent,
  PatchApplyBeginEvent,
  PatchApplyEndEvent,
  McpToolCallBeginEvent,
  McpToolCallEndEvent,
  McpStartupUpdateEvent,
  McpStartupCompleteEvent,
  TokenCountEvent,
  WebSearchBeginEvent,
  WebSearchEndEvent,
  PlanUpdateEvent,
  ApplyPatchApprovalRequestEvent,
  
  // Supporting types
  ParsedCommand,
  SandboxCommandAssessment,
  PatchSummary,
  FileChange,
  McpInvocation,
  McpContent,
  McpToolResult,
  McpStartupStatus,
  McpStartupFailure,
  McpToolDefinition,
  TokenUsage,
  TokenUsageInfo,
  WebSearchResult,
  PlanItem,
  
  // User input
  UserInput,
  Submission,
  
  // Session types
  SessionMetadata,
  SessionListResponse,
  
  // Model types
  ModelInfo,
  ModelPricing,
  
  // Agent types
  AgentDefinition,
  
  // Config types
  CliConfig,
  
  // JSON-RPC
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  JsonRpcNotification,
  
  // Options
  BaseCliOptions,
  ExecOptions,
  RunOptions,
  SessionListOptions,
  AgentOptions,
  
  // Results
  CliResult,
  EventCallback,
  StreamingOptions,
} from "./types";

export {
  // Enums
  AutonomyLevel,
  AskForApproval,
  ReviewDecision,
  SandboxRiskLevel,
  ExecOutputFormat,
  ExecInputFormat,
  RunOutputFormat,
  TurnAbortReason,
  ExecCommandSource,
  ExecOutputStream,
  PlanItemStatus,
  CliExitCode,
} from "./types";

export type { CortexErrorInfo } from "./types";

// ============================================================================
// Errors Export
// ============================================================================

export {
  CortexError,
  CliExecutionError,
  TimeoutError,
  CliNotFoundError,
  PermissionDeniedError,
  AuthenticationError,
  RateLimitError,
  ContextWindowExceededError,
  ModelNotFoundError,
  SessionNotFoundError,
  JsonParseError,
  NetworkError,
  CancelledError,
  type RateLimitInfo,
  type ParsedError,
  type RetryOptions,
  parseCliError,
  createErrorFromResult,
  isCortexError,
  isRecoverableError,
  getRetryDelay,
  withRetry,
  formatError,
  formatErrorForLog,
} from "./errors";

// ============================================================================
// Convenience Re-exports
// ============================================================================

/**
 * Create a configured Cortex client.
 * 
 * This is a convenience function for creating a client with common configurations.
 * 
 * @param options - Client options
 * @returns Configured client instance
 */
export function createCortexClient(options?: {
  model?: string;
  autonomy?: import("./types").AutonomyLevel;
  cwd?: string;
  verbose?: boolean;
}): import("./client").CortexClient {
  const { CortexClient } = require("./client");
  return new CortexClient({
    defaultModel: options?.model,
    defaultAutonomy: options?.autonomy,
    cwd: options?.cwd,
    verbose: options?.verbose,
  });
}

// ============================================================================
// Version
// ============================================================================

/**
 * SDK version string.
 */
export const SDK_VERSION = "1.0.0";

/**
 * SDK metadata.
 */
export const SDK_INFO = {
  name: "@cortex/sdk",
  version: SDK_VERSION,
  description: "TypeScript SDK for the Cortex CLI",
  author: "Cortex Team",
  license: "Apache-2.0",
} as const;
