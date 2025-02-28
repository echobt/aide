import { dirname } from 'path'
import {
  createTmpFileAndWriter,
  type WriteTmpFileResult
} from '@extension/file-utils/tmp-file/create-tmp-file-and-writer'
import { logger } from '@extension/logger'
import EventEmitter from 'eventemitter3'
import { t } from 'i18next'
import * as vscode from 'vscode'

import { CodeEditTaskEntity } from './task-entity'
import {
  CodeEditTask,
  CodeEditTaskState,
  type CodeEditTaskJson,
  type CreateTaskParams
} from './types'

export class CodeEditTaskManager implements vscode.Disposable {
  private tasks = new Map<string, CodeEditTask>()

  readonly onTaskChanged = new EventEmitter<{
    taskUpdated: (task: CodeEditTaskJson) => void
  }>()

  private tempFiles = new Map<string, vscode.Uri>()

  calculateTaskId(
    sessionId: string,
    conversationId: string,
    agentId: string,
    fileUri: vscode.Uri
  ) {
    return `${sessionId}-${conversationId}-${agentId}-${fileUri.fsPath}`
  }

  async createTask(params: CreateTaskParams): Promise<CodeEditTask> {
    const {
      sessionId,
      conversationId,
      agentId,
      fileUri,
      selection,
      isNewFile,
      newContent,
      abortController
    } = params
    const task = new CodeEditTaskEntity(t, {
      id: this.calculateTaskId(sessionId, conversationId, agentId, fileUri),
      sessionId,
      conversationId,
      agentId,
      state: CodeEditTaskState.Initial,
      fileUri,
      isNewFile,
      selectionRange: selection,
      newContent,
      abortController
    }).entity

    return await this.setTask(task)
  }

  getTask(taskId: string): CodeEditTask | undefined {
    return this.tasks.get(taskId)
  }

  async setTask(task: CodeEditTask) {
    if (task.isNewFile) {
      task.existingDirs = await this.findExistingDirs(task.fileUri)
      await this.ensureEmptyFile(task.fileUri)
    } else {
      const document = await vscode.workspace.openTextDocument(task.fileUri)
      task.originalContent = document.getText(task.selectionRange)
    }

    this.tasks.set(task.id, task)
    return task
  }

  private async ensureEmptyFile(fileUri: vscode.Uri) {
    try {
      const dirUri = vscode.Uri.joinPath(fileUri, '..')
      await vscode.workspace.fs.createDirectory(dirUri)

      const edit = new vscode.WorkspaceEdit()
      edit.createFile(fileUri, { overwrite: true, ignoreIfExists: true })
      await vscode.workspace.applyEdit(edit)
    } catch (err) {
      logger.warn('Error ensuring empty file:', err)
    }
  }

  private async findExistingDirs(fileUri: vscode.Uri): Promise<string[]> {
    const existingDirs: string[] = []
    let currentDir = dirname(fileUri.fsPath)

    while (currentDir) {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(currentDir))
        existingDirs.push(currentDir)
        const parentDir = dirname(currentDir)
        if (parentDir === currentDir) break
        currentDir = parentDir
      } catch {
        break
      }
    }

    return existingDirs
  }

  async showDiffView(task: CodeEditTask): Promise<WriteTmpFileResult> {
    const diffWriter = await this.createTempDiffFile(task)
    this.tempFiles.set(task.id, diffWriter.tmpFileUri)

    await vscode.commands.executeCommand(
      'aide.showDiff',
      diffWriter.originalFileUri,
      diffWriter.tmpFileUri,
      false, // closeToFile
      true // preview
    )

    return diffWriter
  }

  private async createTempDiffFile(
    task: CodeEditTask
  ): Promise<WriteTmpFileResult> {
    const languageId = task.isNewFile
      ? task.fileUri.path.split('.').pop() || 'plaintext'
      : (await vscode.workspace.openTextDocument(task.fileUri)).languageId

    return createTmpFileAndWriter({
      originalFileUri: task.fileUri,
      languageId,
      hideDocument: true
    })
  }

  private async updateExistingFile(task: CodeEditTask) {
    const edit = new vscode.WorkspaceEdit()
    edit.replace(task.fileUri, task.selectionRange, task.newContent)
    await vscode.workspace.applyEdit(edit)

    const document = await vscode.workspace.openTextDocument(task.fileUri)
    await document.save()
  }

  async applyChanges(task: CodeEditTask) {
    if (task.isNewFile) {
      await this.createNewFile(task)
    } else {
      await this.updateExistingFile(task)
    }
  }

  private async createNewFile(task: CodeEditTask) {
    if (task) {
      task.abortController?.abort()
    }

    const tempUri = this.tempFiles.get(task.id)
    if (tempUri) {
      try {
        await vscode.commands.executeCommand(
          'aide.replaceFile',
          task.fileUri,
          tempUri,
          false
        )
        await vscode.workspace.fs.delete(tempUri)
      } catch (err) {
        // logger.dev.warn('Error cleaning up temp file:', err)
      }
      this.tempFiles.delete(task.id)
    }
    this.tasks.delete(task.id)
  }

  async rejectChanges(task: CodeEditTask) {
    if (task.isNewFile) {
      await this.cleanupNewFile(task)
    }
    await this.cleanupTask(task.id)
  }

  private async cleanupNewFile(task: CodeEditTask) {
    try {
      await vscode.workspace.fs.delete(task.fileUri)

      if (!task.existingDirs) return

      let currentDir = dirname(task.fileUri.fsPath)

      while (currentDir && !task.existingDirs.includes(currentDir)) {
        try {
          const dirUri = vscode.Uri.file(currentDir)
          const files = await vscode.workspace.fs.readDirectory(dirUri)

          if (files.length === 0) {
            await vscode.workspace.fs.delete(dirUri)
            currentDir = dirname(currentDir)
          } else {
            break
          }
        } catch (err) {
          logger.warn('Error cleaning up directory:', err)
          break
        }
      }
    } catch (err) {
      logger.warn('Error cleaning up new file:', err)
    }
  }

  async cleanupTask(taskId: string) {
    const task = this.getTask(taskId)

    if (task) {
      task.abortController?.abort()
    }

    const tempUri = this.tempFiles.get(taskId)
    if (tempUri) {
      try {
        await vscode.commands.executeCommand(
          'aide.quickCloseFileWithoutSave',
          tempUri
        )
        await vscode.workspace.fs.delete(tempUri)
      } catch (err) {
        // logger.dev.warn('Error cleaning up temp file:', err)
      }
      this.tempFiles.delete(taskId)
    }
    this.tasks.delete(taskId)
  }

  updateTaskState(task: CodeEditTask, state: CodeEditTaskState) {
    task.state = state
    this.onTaskChanged.emit('taskUpdated', CodeEditTaskEntity.toJson(task))
  }

  dispose() {
    this.onTaskChanged.removeAllListeners()
    for (const [taskId] of this.tasks) {
      this.cleanupTask(taskId).catch(err => {
        logger.error('Error disposing task:', err)
      })
    }
  }
}
