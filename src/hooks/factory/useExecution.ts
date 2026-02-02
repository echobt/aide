/**
 * useExecution - Execution tracking hook
 */

import {
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  batch,
  Accessor,
} from "solid-js";

import type {
  WorkflowExecution,
  ExecutionId,
  ExecutionStatus,
  NodeExecution,
  NodeId,
  WorkflowId,
} from "../../types/factory";

import { useFactory } from "../../context/FactoryContext";
import * as eventService from "../../services/factory/eventService";
import type { ExecutionEvent, NodeEvent, ApprovalEvent } from "../../types/factory";

// ============================================================================
// Types
// ============================================================================

export interface ExecutionProgress {
  /** Total number of nodes */
  totalNodes: number;
  /** Number of completed nodes */
  completedNodes: number;
  /** Number of failed nodes */
  failedNodes: number;
  /** Number of skipped nodes */
  skippedNodes: number;
  /** Progress percentage (0-100) */
  percentage: number;
}

export interface UseExecutionOptions {
  /** Automatically subscribe to real-time events */
  autoSubscribe?: boolean;
  /** Called when execution starts */
  onStart?: (execution: WorkflowExecution) => void;
  /** Called when a node starts */
  onNodeStart?: (nodeExecution: NodeExecution) => void;
  /** Called when a node completes */
  onNodeComplete?: (nodeExecution: NodeExecution) => void;
  /** Called when a node fails */
  onNodeFail?: (nodeExecution: NodeExecution) => void;
  /** Called when approval is required */
  onApprovalRequired?: (approval: ApprovalEvent) => void;
  /** Called when execution completes */
  onComplete?: (execution: WorkflowExecution) => void;
  /** Called when execution fails */
  onFail?: (execution: WorkflowExecution) => void;
}

export interface UseExecutionReturn {
  // Execution state
  execution: Accessor<WorkflowExecution | null>;
  status: Accessor<ExecutionStatus | null>;
  isRunning: Accessor<boolean>;
  isPaused: Accessor<boolean>;
  isWaitingApproval: Accessor<boolean>;
  isComplete: Accessor<boolean>;
  isFailed: Accessor<boolean>;
  error: Accessor<string | null>;

  // Node state
  currentNodeId: Accessor<NodeId | null>;
  nodeExecutions: Accessor<Record<NodeId, NodeExecution>>;
  progress: Accessor<ExecutionProgress>;

  // Execution control
  start: (workflowId: WorkflowId, input?: Record<string, unknown>) => Promise<WorkflowExecution>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  retry: () => Promise<WorkflowExecution | null>;

  // Tracking
  track: (executionId: ExecutionId) => Promise<void>;
  untrack: () => void;
  refresh: () => Promise<void>;

  // Node helpers
  getNodeExecution: (nodeId: NodeId) => NodeExecution | undefined;
  isNodeRunning: (nodeId: NodeId) => boolean;
  isNodeComplete: (nodeId: NodeId) => boolean;
  isNodeFailed: (nodeId: NodeId) => boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useExecution(
  executionId?: Accessor<ExecutionId | null>,
  options: UseExecutionOptions = {}
): UseExecutionReturn {
  const {
    autoSubscribe = true,
    onStart,
    onNodeStart,
    onNodeComplete,
    onNodeFail,
    onApprovalRequired,
    onComplete,
    onFail,
  } = options;

  const factory = useFactory();

  // ============================================================================
  // State
  // ============================================================================

  const [execution, setExecution] = createSignal<WorkflowExecution | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  // Subscription handle
  let subscription: eventService.Subscription | null = null;

  // ============================================================================
  // Computed
  // ============================================================================

  const status = createMemo(() => execution()?.status ?? null);

  const isRunning = createMemo(() => status() === "running");
  const isPaused = createMemo(() => status() === "paused");
  const isWaitingApproval = createMemo(() => status() === "waiting_approval");
  const isComplete = createMemo(() => status() === "completed");
  const isFailed = createMemo(() => status() === "failed" || status() === "cancelled");

  const currentNodeId = createMemo(() => execution()?.currentNodeId ?? null);

  const nodeExecutions = createMemo(() => execution()?.nodeExecutions ?? {});

  const progress = createMemo((): ExecutionProgress => {
    const exec = execution();
    if (!exec) {
      return {
        totalNodes: 0,
        completedNodes: 0,
        failedNodes: 0,
        skippedNodes: 0,
        percentage: 0,
      };
    }

    const nodeExecs = Object.values(exec.nodeExecutions);
    const totalNodes = nodeExecs.length;
    const completedNodes = nodeExecs.filter((n) => n.status === "completed").length;
    const failedNodes = nodeExecs.filter((n) => n.status === "failed").length;
    const skippedNodes = nodeExecs.filter((n) => n.status === "skipped").length;

    const percentage =
      totalNodes > 0 ? Math.round(((completedNodes + failedNodes + skippedNodes) / totalNodes) * 100) : 0;

    return {
      totalNodes,
      completedNodes,
      failedNodes,
      skippedNodes,
      percentage,
    };
  });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleExecutionEvent = (event: ExecutionEvent) => {
    const exec = event.execution;
    setExecution(exec);

    if (event.type === "execution:started") {
      onStart?.(exec);
    } else if (event.type === "execution:completed") {
      onComplete?.(exec);
    } else if (event.type === "execution:failed" || event.type === "execution:cancelled") {
      onFail?.(exec);
    }
  };

  const handleNodeEvent = (event: NodeEvent) => {
    setExecution((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodeExecutions: {
          ...prev.nodeExecutions,
          [event.nodeExecution.nodeId]: event.nodeExecution,
        },
        currentNodeId:
          event.type === "node:started" ? event.nodeExecution.nodeId : prev.currentNodeId,
      };
    });

    if (event.type === "node:started") {
      onNodeStart?.(event.nodeExecution);
    } else if (event.type === "node:completed") {
      onNodeComplete?.(event.nodeExecution);
    } else if (event.type === "node:failed") {
      onNodeFail?.(event.nodeExecution);
    }
  };

  const handleApprovalEvent = (event: ApprovalEvent) => {
    if (event.type === "approval:requested") {
      setExecution((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "waiting_approval",
        };
      });
      onApprovalRequired?.(event);
    }
  };

  // ============================================================================
  // Subscription Management
  // ============================================================================

  const subscribe = async (execId: ExecutionId): Promise<void> => {
    // Unsubscribe from previous
    unsubscribe();

    subscription = await eventService.trackExecution(execId, {
      onUpdate: handleExecutionEvent,
      onNodeStart: (event) => handleNodeEvent(event as unknown as NodeEvent),
      onNodeComplete: (event) => handleNodeEvent(event as unknown as NodeEvent),
      onNodeFail: (event) => handleNodeEvent(event as unknown as NodeEvent),
      onApprovalRequired: handleApprovalEvent,
      onComplete: handleExecutionEvent,
      onFail: handleExecutionEvent,
    });
  };

  const unsubscribe = (): void => {
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }
  };

  // ============================================================================
  // Execution Control
  // ============================================================================

  const start = async (
    workflowId: WorkflowId,
    input?: Record<string, unknown>
  ): Promise<WorkflowExecution> => {
    setError(null);

    try {
      const exec = await factory.startExecution(workflowId, input);
      setExecution(exec);

      if (autoSubscribe) {
        await subscribe(exec.id);
      }

      return exec;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to start execution";
      setError(message);
      throw e;
    }
  };

  const stop = async (): Promise<void> => {
    const exec = execution();
    if (!exec) return;

    try {
      await factory.stopExecution(exec.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to stop execution";
      setError(message);
      throw e;
    }
  };

  const pause = async (): Promise<void> => {
    const exec = execution();
    if (!exec) return;

    try {
      await factory.pauseExecution(exec.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to pause execution";
      setError(message);
      throw e;
    }
  };

  const resume = async (): Promise<void> => {
    const exec = execution();
    if (!exec) return;

    try {
      await factory.resumeExecution(exec.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to resume execution";
      setError(message);
      throw e;
    }
  };

  const retry = async (): Promise<WorkflowExecution | null> => {
    const exec = execution();
    if (!exec) return null;

    setError(null);

    try {
      const newExec = await factory.retryExecution(exec.id);
      setExecution(newExec);

      if (autoSubscribe) {
        await subscribe(newExec.id);
      }

      return newExec;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to retry execution";
      setError(message);
      throw e;
    }
  };

  // ============================================================================
  // Tracking
  // ============================================================================

  const track = async (execId: ExecutionId): Promise<void> => {
    setError(null);

    try {
      // Fetch execution data
      const exec = factory.executions().find((e) => e.id === execId);
      if (exec) {
        setExecution(exec);
      } else {
        // Load from backend if not in context
        await factory.loadExecutions();
        const loaded = factory.executions().find((e) => e.id === execId);
        if (loaded) {
          setExecution(loaded);
        }
      }

      if (autoSubscribe) {
        await subscribe(execId);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to track execution";
      setError(message);
      throw e;
    }
  };

  const untrack = (): void => {
    unsubscribe();
    setExecution(null);
    setError(null);
  };

  const refresh = async (): Promise<void> => {
    const exec = execution();
    if (!exec) return;

    try {
      await factory.loadExecutions();
      const updated = factory.executions().find((e) => e.id === exec.id);
      if (updated) {
        setExecution(updated);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to refresh execution";
      setError(message);
    }
  };

  // ============================================================================
  // Node Helpers
  // ============================================================================

  const getNodeExecution = (nodeId: NodeId): NodeExecution | undefined => {
    return nodeExecutions()[nodeId];
  };

  const isNodeRunning = (nodeId: NodeId): boolean => {
    const node = getNodeExecution(nodeId);
    return node?.status === "running";
  };

  const isNodeComplete = (nodeId: NodeId): boolean => {
    const node = getNodeExecution(nodeId);
    return node?.status === "completed";
  };

  const isNodeFailed = (nodeId: NodeId): boolean => {
    const node = getNodeExecution(nodeId);
    return node?.status === "failed";
  };

  // ============================================================================
  // Effects
  // ============================================================================

  // Track execution when ID changes
  createEffect(() => {
    const id = executionId?.();
    if (id) {
      track(id).catch(console.error);
    } else {
      untrack();
    }
  });

  // Update from context changes
  createEffect(() => {
    const exec = execution();
    if (!exec) return;

    const contextExec = factory.executions().find((e) => e.id === exec.id);
    if (contextExec && contextExec !== exec) {
      setExecution(contextExec);
    }
  });

  // Cleanup
  onCleanup(() => {
    unsubscribe();
  });

  // ============================================================================
  // Return
  // ============================================================================

  return {
    execution,
    status,
    isRunning,
    isPaused,
    isWaitingApproval,
    isComplete,
    isFailed,
    error,

    currentNodeId,
    nodeExecutions,
    progress,

    start,
    stop,
    pause,
    resume,
    retry,

    track,
    untrack,
    refresh,

    getNodeExecution,
    isNodeRunning,
    isNodeComplete,
    isNodeFailed,
  };
}
