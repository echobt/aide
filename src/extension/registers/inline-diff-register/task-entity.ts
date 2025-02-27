import {
  convertRangeJsonToVSCodeRange,
  convertUriJsonToVSCodeUri
} from '@extension/utils'
import { BaseEntity } from '@shared/entities'
import { t, type TFunction } from 'i18next'
import { v4 as uuidv4 } from 'uuid'
import * as vscode from 'vscode'

import { HistoryManager } from './history-manager'
import {
  InlineDiffTaskState,
  type InlineDiffTask,
  type InlineDiffTaskJson
} from './types'

export class CodeEditTaskEntity extends BaseEntity<InlineDiffTask> {
  protected getDefaults(t: TFunction, override?: Partial<InlineDiffTask>) {
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
      isNewFile: false,
      history: new HistoryManager(),
      ...override
    }
  }

  static toJson(task: InlineDiffTask): InlineDiffTaskJson {
    return JSON.parse(JSON.stringify(task))
  }

  static fromJson(
    taskJsonData: InlineDiffTaskJson | InlineDiffTask
  ): InlineDiffTask {
    const task: InlineDiffTask = new CodeEditTaskEntity(t, {
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
