import {
  createTmpFileAndWriter,
  type WriteTmpFileResult
} from '@extension/file-utils/tmp-file/create-tmp-file-and-writer'
import { logger } from '@extension/logger'
import { settledPromiseResults } from '@shared/utils/common'
import * as vscode from 'vscode'

import { TaskEntity } from '../inline-diff-register/task-entity'
import {
  InlineDiffTask,
  InlineDiffTaskState
} from '../inline-diff-register/types'

export class TaskManager implements vscode.Disposable {
  private tasks = new Map<string, InlineDiffTask>()

  private taskIdTmpFileUriMap = new Map<string, vscode.Uri>()

  async createTask(
    taskId: string,
    fileUri: vscode.Uri,
    selection: vscode.Range,
    replacementContent: string,
    abortController?: AbortController
  ): Promise<InlineDiffTask> {
    const document = await vscode.workspace.openTextDocument(fileUri)
    const selectionContent = document.getText(selection)

    const task = new TaskEntity({
      id: taskId,
      state: InlineDiffTaskState.Idle,
      selectionRange: selection,
      selectionContent,
      contentAfterSelection: '',
      replacementContent,
      originalFileUri: fileUri,
      abortController,
      lastKnownDocumentVersion: document.version,
      diffBlocks: [],
      waitForReviewDiffBlockIds: [],
      originalWaitForReviewDiffBlockIdCount: 0
    }).entity

    this.tasks.set(taskId, task)
    return task
  }

  getTempFileUri(taskId: string): vscode.Uri | undefined {
    return this.taskIdTmpFileUriMap.get(taskId)
  }

  async showDiffView(task: InlineDiffTask): Promise<WriteTmpFileResult> {
    // create temp file for diff
    const diffWriter = await this.createTempDiffFileWriter(task)
    this.taskIdTmpFileUriMap.set(task.id, diffWriter.tmpFileUri)

    // open diff editor
    await vscode.commands.executeCommand(
      'aide.showDiff',
      diffWriter.originalFileUri,
      diffWriter.tmpFileUri
    )

    return diffWriter
  }

  private async createTempDiffFileWriter(
    task: InlineDiffTask
  ): Promise<WriteTmpFileResult> {
    const originalDocument = await vscode.workspace.openTextDocument(
      task.originalFileUri
    )
    const writer = await createTmpFileAndWriter({
      originalFileUri: task.originalFileUri,
      languageId: originalDocument.languageId,
      hideDocument: true
    })

    writer.writeText(task.replacementContent)
    return writer
  }

  async acceptChanges(task: InlineDiffTask) {
    const document = await vscode.workspace.openTextDocument(
      task.originalFileUri
    )
    const edit = new vscode.WorkspaceEdit()
    edit.replace(
      task.originalFileUri,
      task.selectionRange,
      task.replacementContent
    )
    await vscode.workspace.applyEdit(edit)
    await document.save()
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  async rejectChanges(task: InlineDiffTask) {
    // close diff editor and tmp file
    await this.resetAndCleanHistory(task.id)
  }

  async resetAndCleanHistory(taskId: string) {
    const diffUri = this.taskIdTmpFileUriMap.get(taskId)

    if (diffUri) {
      try {
        await vscode.commands.executeCommand(
          'aide.quickCloseFileWithoutSave',
          diffUri
        )
      } catch (err) {
        logger.warn('Error closing diff file', err)
      }
      this.taskIdTmpFileUriMap.delete(taskId)
    }

    this.tasks.delete(taskId)
  }

  getTask(taskId: string): InlineDiffTask | undefined {
    return this.tasks.get(taskId)
  }

  updateTaskState(task: InlineDiffTask, state: InlineDiffTaskState) {
    task.state = state
  }

  async dispose() {
    // clean all temp files
    await settledPromiseResults(
      Array.from(this.taskIdTmpFileUriMap.values()).map(
        async uri => await vscode.workspace.fs.delete(uri)
      )
    )
    this.tasks.clear()
    this.taskIdTmpFileUriMap.clear()
  }
}
