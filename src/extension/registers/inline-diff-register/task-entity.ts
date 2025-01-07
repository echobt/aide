import {
  convertRangeJsonToVSCodeRange,
  convertUriJsonToVSCodeUri,
  type VSCodeRangeJson,
  type VSCodeUriJson
} from '@extension/utils'
import { BaseEntity } from '@shared/entities'
import { v4 as uuidv4 } from 'uuid'
import * as vscode from 'vscode'

import { HistoryManager } from './history-manager'
import {
  InlineDiffTaskState,
  type DiffAction,
  type InlineDiffTask
} from './types'

export interface TaskEntityJsonData
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

export class TaskEntity extends BaseEntity<InlineDiffTask> {
  protected getDefaults(override?: Partial<InlineDiffTask>) {
    return {
      id: uuidv4(),
      state: InlineDiffTaskState.Idle,
      selectionRange: new vscode.Range(0, 0, 0, 0),
      selectionContent: '',
      contentAfterSelection: '',
      replacementContent: '',
      originalFileUri: vscode.Uri.file(''),
      diffBlocks: [],
      lastKnownDocumentVersion: 0,
      waitForReviewDiffBlockIds: [],
      originalWaitForReviewDiffBlockIdCount: 0,
      history: new HistoryManager(),
      ...override
    }
  }

  static toJson(task: InlineDiffTask): TaskEntityJsonData {
    return JSON.parse(JSON.stringify(task))
  }

  static fromJson(
    taskJsonData: TaskEntityJsonData | InlineDiffTask
  ): InlineDiffTask {
    const task: InlineDiffTask = new TaskEntity({
      ...taskJsonData,
      selectionRange: convertRangeJsonToVSCodeRange(
        taskJsonData.selectionRange
      ),
      originalFileUri: convertUriJsonToVSCodeUri(taskJsonData.originalFileUri),
      error:
        taskJsonData.error instanceof Error
          ? taskJsonData.error
          : typeof taskJsonData.error === 'string'
            ? new Error(taskJsonData.error)
            : undefined,
      history:
        taskJsonData.history instanceof HistoryManager
          ? taskJsonData.history
          : new HistoryManager({
              ...taskJsonData.history
            }),
      abortController:
        taskJsonData.abortController instanceof AbortController
          ? taskJsonData.abortController
          : taskJsonData.abortController
            ? new AbortController()
            : undefined
    }).entity

    return task
  }
}
