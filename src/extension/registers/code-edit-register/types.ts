import type { Range, Uri } from 'vscode'

export enum CodeEditTaskState {
  Initial = 'Initial',
  Generating = 'Generating',
  WaitingForReview = 'WaitingForReview',
  Accepted = 'Accepted',
  Rejected = 'Rejected',
  Error = 'Error'
}

// Represents a code edit task
export interface CodeEditTask {
  id: string // task id = sessionId-conversationId-agentId-fileUri
  sessionId: string
  conversationId: string
  agentId: string
  state: CodeEditTaskState

  // File info
  fileUri: Uri
  isNewFile: boolean
  existingDirs?: string[] // record existing parent directories when creating a new file

  // Edit content
  selectionRange: Range
  originalContent: string // Selected content or empty for new files
  newContent: string // Content to replace selection with

  // Metadata
  error?: Error
  abortController?: AbortController
}

export type CodeEditTaskJson = Omit<
  CodeEditTask,
  'fileUri' | 'selectionRange' | 'error' | 'abortController'
> & {
  fileUri: string
  selectionRange: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
  error?: string
}

export type CreateTaskParams = {
  sessionId: string
  conversationId: string
  agentId: string
  fileUri: Uri
  selection: Range
  isNewFile: boolean
  newContent: string
  abortController?: AbortController
}
