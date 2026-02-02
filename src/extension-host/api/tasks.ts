/**
 * Tasks API for Extensions
 *
 * Provides the cortex.tasks namespace for extensions to:
 * - Access running task executions
 * - Subscribe to task lifecycle events
 * - Register custom task providers
 * - Query and execute tasks
 *
 * This module bridges the extension host with the TasksContext in the main thread.
 */

import {
  Disposable,
  DisposableStore,
  EventEmitter,
  Event,
  createDisposable,
  CancellationToken,
} from "../types";
import type { ExtensionApiBridge } from "../ExtensionAPI";

// ============================================================================
// Task Types (compatible with VSCode's task API)
// ============================================================================

/**
 * Task group kinds
 */
export type TaskGroup = "build" | "test" | "run" | "clean" | "deploy" | "none";

/**
 * Task scope - where the task is defined
 */
export enum TaskScope {
  /** Task is defined globally */
  Global = 1,
  /** Task is defined in the workspace */
  Workspace = 2,
}

/**
 * Task definition that identifies a task type
 */
export interface TaskDefinition {
  /** The task definition type (e.g., 'npm', 'shell', 'cargo') */
  readonly type: string;
  /** Additional properties that identify the task */
  [key: string]: unknown;
}

/**
 * Task group with optional default flag
 */
export interface TaskGroupDefinition {
  /** The group kind */
  kind: TaskGroup;
  /** Whether this is the default task in the group */
  isDefault?: boolean;
}

/**
 * Presentation options for task terminal
 */
export interface TaskPresentationOptions {
  /** When to reveal the terminal */
  reveal?: "always" | "silent" | "never";
  /** Whether to focus the terminal */
  focus?: boolean;
  /** Panel sharing behavior */
  panel?: "shared" | "dedicated" | "new";
  /** Whether to show reuse message */
  showReuseMessage?: boolean;
  /** Whether to clear terminal before execution */
  clear?: boolean;
  /** Whether to close terminal on success */
  close?: boolean;
  /** Whether to echo the command */
  echo?: boolean;
}

/**
 * Run options for task execution
 */
export interface RunOptions {
  /** Whether to re-evaluate variables on rerun */
  reevaluateOnRerun?: boolean;
}

/**
 * Represents a task that can be executed
 */
export interface Task {
  /** Task definition identifying the task type */
  definition: TaskDefinition;
  /** Task scope */
  scope?: TaskScope;
  /** Human readable name of the task */
  name: string;
  /** Optional detail shown in UI */
  detail?: string;
  /** Source identifier (e.g., 'npm', 'workspace') */
  source: string;
  /** Task group (build, test, etc.) */
  group?: TaskGroup | TaskGroupDefinition;
  /** Presentation options */
  presentationOptions?: TaskPresentationOptions;
  /** Problem matchers to parse output */
  problemMatchers?: string[];
  /** Run options */
  runOptions?: RunOptions;
  /** Whether this is a background task */
  isBackground?: boolean;
}

/**
 * Represents a running task execution
 */
export interface TaskExecution {
  /** The task being executed */
  task: Task;
  /** Terminate this execution */
  terminate(): void;
}

/**
 * Event fired when a task starts
 */
export interface TaskStartEvent {
  /** The execution that started */
  execution: TaskExecution;
}

/**
 * Event fired when a task ends
 */
export interface TaskEndEvent {
  /** The execution that ended */
  execution: TaskExecution;
  /** Exit code if available */
  exitCode?: number;
}

/**
 * Event fired when a task's underlying process starts
 */
export interface TaskProcessStartEvent {
  /** The associated task execution */
  execution: TaskExecution;
  /** Process ID */
  processId: number;
}

/**
 * Event fired when a task's underlying process ends
 */
export interface TaskProcessEndEvent {
  /** The associated task execution */
  execution: TaskExecution;
  /** Exit code of the process */
  exitCode: number;
}

/**
 * Filter for querying tasks
 */
export interface TaskFilter {
  /** Filter by task type (e.g., 'npm', 'shell') */
  type?: string;
  /** Filter by version - unused, for compatibility */
  version?: string;
}

/**
 * Task provider interface for auto-detection
 */
export interface TaskProvider<T extends Task = Task> {
  /**
   * Provides tasks that can be executed.
   * @param token Cancellation token
   * @returns Tasks or a promise resolving to tasks
   */
  provideTasks(token: CancellationToken): T[] | undefined | null | Promise<T[] | undefined | null>;

  /**
   * Resolves a task that has no execution details.
   * @param task Task to resolve
   * @param token Cancellation token
   * @returns The resolved task or undefined
   */
  resolveTask(
    task: T,
    token: CancellationToken
  ): T | undefined | null | Promise<T | undefined | null>;
}

// ============================================================================
// Tasks API Interface
// ============================================================================

/**
 * Tasks API exposed to extensions as `cortex.tasks`
 */
export interface TasksApi {
  /**
   * Currently active task executions.
   * Includes both regular and background tasks.
   */
  readonly taskExecutions: readonly TaskExecution[];

  /**
   * Event fired when a task starts executing.
   */
  readonly onDidStartTask: Event<TaskStartEvent>;

  /**
   * Event fired when a task finishes executing.
   */
  readonly onDidEndTask: Event<TaskEndEvent>;

  /**
   * Event fired when a task's process starts.
   */
  readonly onDidStartTaskProcess: Event<TaskProcessStartEvent>;

  /**
   * Event fired when a task's process ends.
   */
  readonly onDidEndTaskProcess: Event<TaskProcessEndEvent>;

  /**
   * Register a task provider for a specific task type.
   * @param type The task type to register for (e.g., 'npm', 'cargo')
   * @param provider The task provider implementation
   * @returns A disposable that unregisters the provider
   */
  registerTaskProvider(type: string, provider: TaskProvider): Disposable;

  /**
   * Fetch all available tasks, optionally filtered.
   * @param filter Optional filter to narrow results
   * @returns Promise resolving to matching tasks
   */
  fetchTasks(filter?: TaskFilter): Promise<Task[]>;

  /**
   * Execute a task.
   * @param task The task to execute
   * @returns Promise resolving to the task execution
   */
  executeTask(task: Task): Promise<TaskExecution>;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Internal representation of a task execution tracking
 */
interface TaskExecutionInternal {
  id: string;
  task: Task;
  terminalId?: string;
  startedAt: number;
}

/**
 * Data from main thread for task execution events
 */
interface TaskExecutionData {
  id: string;
  taskLabel: string;
  taskType: string;
  taskSource: string;
  taskGroup?: string;
  terminalId?: string;
  isBackground?: boolean;
}

/**
 * Data from main thread for task end events
 */
interface TaskEndData extends TaskExecutionData {
  exitCode?: number;
}

/**
 * Data from main thread for task process events
 */
interface TaskProcessData extends TaskExecutionData {
  processId: number;
}

// ============================================================================
// Tasks API Implementation
// ============================================================================

/**
 * Create the tasks API for an extension.
 *
 * @param extensionId The unique identifier of the extension
 * @param bridge Bridge for communicating with the main thread
 * @param disposables Store for tracking disposables
 * @returns The tasks API instance
 */
export function createTasksApi(
  extensionId: string,
  bridge: ExtensionApiBridge,
  disposables: DisposableStore
): TasksApi {
  // Track active task executions
  const activeExecutions = new Map<string, TaskExecutionInternal>();
  let providerIdCounter = 0;

  // Event emitters for task lifecycle events
  const onDidStartTaskEmitter = new EventEmitter<TaskStartEvent>();
  const onDidEndTaskEmitter = new EventEmitter<TaskEndEvent>();
  const onDidStartTaskProcessEmitter = new EventEmitter<TaskProcessStartEvent>();
  const onDidEndTaskProcessEmitter = new EventEmitter<TaskProcessEndEvent>();

  disposables.add(onDidStartTaskEmitter);
  disposables.add(onDidEndTaskEmitter);
  disposables.add(onDidStartTaskProcessEmitter);
  disposables.add(onDidEndTaskProcessEmitter);

  // Helper to convert main thread data to Task object
  function dataToTask(data: TaskExecutionData): Task {
    return {
      definition: { type: data.taskType },
      name: data.taskLabel,
      source: data.taskSource || "workspace",
      group: (data.taskGroup as TaskGroup) || undefined,
      isBackground: data.isBackground,
    };
  }

  // Helper to create TaskExecution from internal tracking
  function createTaskExecution(internal: TaskExecutionInternal): TaskExecution {
    return {
      task: internal.task,
      terminate() {
        bridge.callMainThread(extensionId, "tasks", "terminateExecution", [internal.id]);
      },
    };
  }

  // Subscribe to task start events from main thread
  disposables.add(
    bridge.subscribeEvent("tasks.started", (data) => {
      const taskData = data as TaskExecutionData;
      const task = dataToTask(taskData);

      const internal: TaskExecutionInternal = {
        id: taskData.id,
        task,
        terminalId: taskData.terminalId,
        startedAt: Date.now(),
      };

      activeExecutions.set(taskData.id, internal);

      onDidStartTaskEmitter.fire({
        execution: createTaskExecution(internal),
      });
    })
  );

  // Subscribe to task end events from main thread
  disposables.add(
    bridge.subscribeEvent("tasks.ended", (data) => {
      const taskData = data as TaskEndData;
      const internal = activeExecutions.get(taskData.id);

      if (internal) {
        activeExecutions.delete(taskData.id);

        onDidEndTaskEmitter.fire({
          execution: createTaskExecution(internal),
          exitCode: taskData.exitCode,
        });
      }
    })
  );

  // Subscribe to task process start events
  disposables.add(
    bridge.subscribeEvent("tasks.processStarted", (data) => {
      const taskData = data as TaskProcessData;
      const internal = activeExecutions.get(taskData.id);

      if (internal) {
        onDidStartTaskProcessEmitter.fire({
          execution: createTaskExecution(internal),
          processId: taskData.processId,
        });
      }
    })
  );

  // Subscribe to task process end events
  disposables.add(
    bridge.subscribeEvent("tasks.processEnded", (data) => {
      const taskData = data as TaskProcessData & { exitCode: number };
      const internal = activeExecutions.get(taskData.id);

      if (internal) {
        onDidEndTaskProcessEmitter.fire({
          execution: createTaskExecution(internal),
          exitCode: taskData.exitCode,
        });
      }
    })
  );

  // Track registered providers for this extension
  const registeredProviders = new Map<string, Disposable>();

  return {
    get taskExecutions(): readonly TaskExecution[] {
      return Array.from(activeExecutions.values()).map(createTaskExecution);
    },

    onDidStartTask: onDidStartTaskEmitter.event,
    onDidEndTask: onDidEndTaskEmitter.event,
    onDidStartTaskProcess: onDidStartTaskProcessEmitter.event,
    onDidEndTaskProcess: onDidEndTaskProcessEmitter.event,

    registerTaskProvider(type: string, provider: TaskProvider): Disposable {
      const providerId = `${extensionId}.taskProvider.${type}.${++providerIdCounter}`;

      // Register with main thread
      bridge.callMainThread(extensionId, "tasks", "registerProvider", [providerId, type]);

      // Handle provide tasks requests
      const provideTasksSub = bridge.subscribeEvent(
        `tasks.${providerId}.provideTasks`,
        async (data) => {
          const { requestId, token } = data as {
            requestId: string;
            token: CancellationToken;
          };

          try {
            const tasks = await provider.provideTasks(token);
            bridge.callMainThread(extensionId, "tasks", "provideTasksResponse", [
              requestId,
              tasks ?? [],
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "tasks", "provideTasksResponse", [
              requestId,
              [],
              String(error),
            ]);
          }
        }
      );

      // Handle resolve task requests
      const resolveTaskSub = bridge.subscribeEvent(
        `tasks.${providerId}.resolveTask`,
        async (data) => {
          const { requestId, task, token } = data as {
            requestId: string;
            task: Task;
            token: CancellationToken;
          };

          try {
            const resolved = await provider.resolveTask(task, token);
            bridge.callMainThread(extensionId, "tasks", "resolveTaskResponse", [
              requestId,
              resolved,
            ]);
          } catch (error) {
            bridge.callMainThread(extensionId, "tasks", "resolveTaskResponse", [
              requestId,
              null,
              String(error),
            ]);
          }
        }
      );

      const disposable = createDisposable(() => {
        provideTasksSub.dispose();
        resolveTaskSub.dispose();
        registeredProviders.delete(providerId);
        bridge.callMainThread(extensionId, "tasks", "unregisterProvider", [providerId]);
      });

      registeredProviders.set(providerId, disposable);
      disposables.add(disposable);
      return disposable;
    },

    async fetchTasks(filter?: TaskFilter): Promise<Task[]> {
      const tasksData = await bridge.callMainThread<Array<{
        label: string;
        type: string;
        source?: string;
        group?: string;
        isBackground?: boolean;
        detail?: string;
        problemMatcher?: string[];
      }>>(extensionId, "tasks", "fetchTasks", [filter]);

      return tasksData.map((data) => ({
        definition: { type: data.type },
        name: data.label,
        detail: data.detail,
        source: data.source || "workspace",
        group: (data.group as TaskGroup) || undefined,
        isBackground: data.isBackground,
        problemMatchers: data.problemMatcher,
      }));
    },

    async executeTask(task: Task): Promise<TaskExecution> {
      const executionId = await bridge.callMainThread<string>(
        extensionId,
        "tasks",
        "executeTask",
        [
          {
            label: task.name,
            type: task.definition.type,
            source: task.source,
            group: typeof task.group === "string" ? task.group : task.group?.kind,
            isBackground: task.isBackground,
            presentation: task.presentationOptions,
            problemMatcher: task.problemMatchers,
            runOptions: task.runOptions,
          },
        ]
      );

      // Create internal tracking for the execution
      const internal: TaskExecutionInternal = {
        id: executionId,
        task,
        startedAt: Date.now(),
      };

      activeExecutions.set(executionId, internal);

      return createTaskExecution(internal);
    },
  };
}

// ============================================================================
// Exports for External Use
// ============================================================================

// Note: TaskScope is already exported at its enum definition (line 35)
