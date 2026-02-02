/**
 * Factory Service - Public Exports
 * Re-exports all factory service functionality
 */

// ============================================================================
// Factory Service (Tauri Commands)
// ============================================================================

export {
  // Error handling
  FactoryServiceError,
  
  // Workflow CRUD
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  duplicateWorkflow,
  exportWorkflow,
  importWorkflow,
  validateWorkflow,
  
  // Execution Control
  startExecution,
  stopExecution,
  pauseExecution,
  resumeExecution,
  retryExecution,
  getExecution,
  listExecutions,
  getExecutionLogs,
  
  // Agent Management
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  duplicateAgent,
  testAgent,
  
  // Approval Operations
  listApprovals,
  getApproval,
  respondToApproval,
  approveRequest,
  denyRequest,
  modifyAndApprove,
  
  // Audit Log
  getAuditLog,
  getAuditEntry,
  exportAuditLog,
  getAuditStats,
  
  // Tools
  listTools,
  executeTool,
  
  // Templates
  listTemplates,
  createFromTemplate,
  
  // Batch Operations
  batchUpdateNodes,
  batchUpdateEdges,
} from "./factoryService";

// ============================================================================
// Event Service (Tauri Events)
// ============================================================================

export {
  // Types
  type WorkflowEventHandler,
  type ExecutionEventHandler,
  type NodeEventHandler,
  type ApprovalEventHandler,
  type AgentEventHandler,
  type FactoryEventHandler,
  type EventFilter,
  type Subscription,
  
  // Subscription Functions
  subscribeToAllEvents,
  subscribeToWorkflowEvents,
  subscribeToExecutionEvents,
  subscribeToNodeEvents,
  subscribeToApprovalEvents,
  subscribeToAgentEvents,
  
  // Specialized Subscriptions
  trackExecution,
  subscribeToPendingApprovals,
  
  // Event Utilities
  isEventType,
  isExecutionComplete,
  isErrorEvent,
} from "./eventService";
