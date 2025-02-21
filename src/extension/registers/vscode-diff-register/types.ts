import type { VSCodeRangeJson, VSCodeUriJson } from '@extension/utils'
import type { Range, Uri } from 'vscode'

export enum InlineDiffTaskState {
  Idle = 'Idle',
  Generating = 'Generating',
  Reviewing = 'Reviewing',
  Accepted = 'Accepted',
  Rejected = 'Rejected',
  Error = 'Error'
}

export interface DiffBlock {
  id: string
  type: 'add' | 'remove' | 'no-change'
  oldStart: number
  oldLines: string[]
  newStart: number
  newLines: string[]
}

export interface DiffBlockWithRange extends DiffBlock {
  displayRange: Range
  status: 'pending' | 'accept' | 'reject'
  renderedLines: string[]
}

export interface DiffEdit {
  blockId: string
  editType: 'accept' | 'reject'
}

export interface DiffAction {
  id: string
  edits: DiffEdit[]
  timestamp: number
}

export interface InlineDiffTask {
  id: string
  state: InlineDiffTaskState
  selectionRange: Range
  selectionContent: string
  contentAfterSelection: string
  replacementContent: string
  originalFileUri: Uri
  diffBlocks: DiffBlock[]
  abortController?: AbortController
  error?: Error
  lastKnownDocumentVersion: number
  waitForReviewDiffBlockIds: string[]
  originalWaitForReviewDiffBlockIdCount: number
  isNewFile?: boolean
}

export interface InlineDiffTaskJson
  extends Omit<
    InlineDiffTask,
    'selectionRange' | 'originalFileUri' | 'history' | 'error'
  > {
  selectionRange: VSCodeRangeJson
  originalFileUri: VSCodeUriJson
  error?: string
  history: {
    actions: DiffAction[]
    position: number
  }
}
