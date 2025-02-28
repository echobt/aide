import { ModelProviderFactory } from '@extension/ai/model-providers/helpers/factory'
import { logger } from '@extension/logger'
import { removeCodeBlockSyntax } from '@extension/utils'
import type { AIMessageChunk } from '@langchain/core/messages'
import type { IterableReadableStream } from '@langchain/core/utils/stream'
import { t } from 'i18next'
import * as vscode from 'vscode'

import { CodeEditTaskManager } from './task-manager'
import { CodeEditTask, CodeEditTaskState, type CreateTaskParams } from './types'

export class CodeEditProvider implements vscode.Disposable {
  readonly taskManager: CodeEditTaskManager

  private disposables: vscode.Disposable[] = []

  constructor() {
    this.taskManager = new CodeEditTaskManager()
  }

  // Create a new edit task
  async createTask(params: CreateTaskParams): Promise<CodeEditTask> {
    return this.taskManager.createTask(params)
  }

  // Start streaming AI generated content
  async *streamEditContent(
    taskIdOrTask: string | CodeEditTask,
    getAiStream: (
      abortController: AbortController
    ) => Promise<IterableReadableStream<AIMessageChunk>>
  ): AsyncGenerator<CodeEditTask> {
    let task: CodeEditTask | undefined

    if (typeof taskIdOrTask === 'string') {
      task = this.taskManager.getTask(taskIdOrTask)
    } else {
      task = taskIdOrTask
    }

    if (!task) throw new Error(t('extension.codeEdit.errors.taskNotFound'))
    task = await this.taskManager.setTask(task)

    try {
      if (task.isNewFile || (!task.originalContent && task.newContent)) {
        const diffWriter = await this.taskManager.showDiffView(task)
        await diffWriter.writeText(task.newContent)
        this.taskManager.updateTaskState(
          task,
          CodeEditTaskState.WaitingForReview
        )
        yield task
        return
      }

      // Update task state
      this.taskManager.updateTaskState(task, CodeEditTaskState.Generating)
      yield task

      // Setup abort controller if needed
      if (!task.abortController) {
        task.abortController = new AbortController()
      }

      // Get AI stream
      const aiStream = await getAiStream(task.abortController)

      // Show diff view
      const diffWriter = await this.taskManager.showDiffView(task)
      let content = ''

      // Stream content chunks
      for await (const chunk of aiStream) {
        content += ModelProviderFactory.formatMessageContent(chunk.content)
        task.newContent = content
        await diffWriter.writeText(content)
      }

      task.newContent = removeCodeBlockSyntax(content)
      await diffWriter.writeText(task.newContent)

      // Update final state
      this.taskManager.updateTaskState(task, CodeEditTaskState.WaitingForReview)
      yield task
    } catch (error) {
      this.handleTaskError(task, error)
      yield task
    }
  }

  // Accept all changes
  async acceptChanges(task: CodeEditTask): Promise<CodeEditTask> {
    await this.taskManager.applyChanges(task)
    this.taskManager.updateTaskState(task, CodeEditTaskState.Accepted)
    return task
  }

  // Reject changes
  async rejectChanges(task: CodeEditTask): Promise<CodeEditTask> {
    await this.taskManager.rejectChanges(task)
    this.taskManager.updateTaskState(task, CodeEditTaskState.Rejected)
    return task
  }

  // Clean up task resources
  async cleanupTask(taskId: string): Promise<void> {
    await this.taskManager.cleanupTask(taskId)
  }

  private handleTaskError(task: CodeEditTask, error: unknown) {
    task.error = error instanceof Error ? error : new Error(String(error))
    this.taskManager.updateTaskState(task, CodeEditTaskState.Error)
    logger.error('Task error:', error)
  }

  dispose() {
    this.taskManager.dispose()
    this.disposables.forEach(d => d.dispose())
    this.disposables = []
  }
}
