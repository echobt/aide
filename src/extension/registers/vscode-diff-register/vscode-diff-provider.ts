import { ModelProviderFactory } from '@extension/ai/model-providers/helpers/factory'
import { logger } from '@extension/logger'
import {
  removeCodeBlockEndSyntax,
  removeCodeBlockStartSyntax,
  removeCodeBlockSyntax
} from '@extension/utils'
import type { AIMessageChunk } from '@langchain/core/messages'
import type { IterableReadableStream } from '@langchain/core/utils/stream'
import * as vscode from 'vscode'

import { CodeEditTaskEntity } from './task-entity'
import { TaskManager } from './task-manager'
import {
  InlineDiffTaskState,
  type InlineDiffTask,
  type InlineDiffTaskJson
} from './types'

export class VSCodeDiffProvider implements vscode.Disposable {
  taskManager: TaskManager

  private disposables: vscode.Disposable[] = []

  taskChangeEmitter = new vscode.EventEmitter<InlineDiffTaskJson>()

  constructor() {
    this.taskManager = new TaskManager()
  }

  async createTask(
    taskId: string,
    fileUri: vscode.Uri,
    selection: vscode.Range,
    replacementContent: string,
    abortController?: AbortController
  ): Promise<InlineDiffTask> {
    return this.taskManager.createTask(
      taskId,
      fileUri,
      selection,
      replacementContent,
      abortController
    )
  }

  async *startStreamTask(
    taskId: string,
    buildAiStream: (
      abortController: AbortController
    ) => Promise<IterableReadableStream<AIMessageChunk>>
  ): AsyncGenerator<InlineDiffTask> {
    const task = this.taskManager.getTask(taskId)
    if (!task) throw new Error('Task not found')

    try {
      if (task.isNewFile) {
        // For new files, directly show the full content
        // show diff view with full content
        const diffWriter = await this.taskManager.showDiffView(task)
        await diffWriter.writeText(task.replacementContent)

        // update task state to reviewing
        this.taskManager.updateTaskState(task, InlineDiffTaskState.Reviewing)
        yield task
      } else {
        // update task state to generating
        this.taskManager.updateTaskState(task, InlineDiffTaskState.Generating)

        if (!task.abortController) {
          task.abortController = new AbortController()
        }

        yield task

        // handle ai stream
        const aiStream = await buildAiStream(task.abortController!)
        const streamChunks = await this.processStreamChunks(aiStream)
        await this.setupDocumentChangeListener(task)
        let content = ''

        // show diff view
        const diffWriter = await this.taskManager.showDiffView(task)

        for await (const chunk of streamChunks) {
          content += chunk
          task.replacementContent = this.getGeneratedFullLinesContent(
            removeCodeBlockStartSyntax(content)
          )

          // write the content to the diff file
          await diffWriter.writeText(task.replacementContent)

          yield task
        }

        task.replacementContent = removeCodeBlockSyntax(
          removeCodeBlockEndSyntax(task.replacementContent)
        )

        await diffWriter.writeText(task.replacementContent)

        // update task state to reviewing
        this.taskManager.updateTaskState(task, InlineDiffTaskState.Reviewing)
        yield task
      }
    } catch (error) {
      this.handleTaskError(task, error)
      yield task
    }
  }

  private async *processStreamChunks(
    aiStream: IterableReadableStream<AIMessageChunk>
  ): AsyncIterableIterator<string> {
    for await (const chunk of aiStream) {
      yield ModelProviderFactory.formatMessageContent(chunk.content)
    }
  }

  private getGeneratedFullLinesContent(content: string): string {
    const lines = content.split('\n')
    return lines.slice(0, lines.length - 1).join('\n')
  }

  private handleTaskError(task: InlineDiffTask, error: unknown) {
    task.state = InlineDiffTaskState.Error
    task.error = error instanceof Error ? error : new Error(String(error))
    logger.error('Error in task', error)
  }

  async acceptAll(task: InlineDiffTask): Promise<InlineDiffTask> {
    await this.taskManager.acceptChanges(task)
    this.taskManager.updateTaskState(task, InlineDiffTaskState.Accepted)
    this.taskChangeEmitter.fire(CodeEditTaskEntity.toJson(task))
    return task
  }

  async rejectAll(task: InlineDiffTask): Promise<InlineDiffTask> {
    await this.taskManager.rejectChanges(task)
    this.taskManager.updateTaskState(task, InlineDiffTaskState.Rejected)
    this.taskChangeEmitter.fire(CodeEditTaskEntity.toJson(task))
    return task
  }

  async resetAndCleanHistory(taskId: string): Promise<void> {
    await this.taskManager.resetAndCleanHistory(taskId)
  }

  setupDocumentChangeListener(task: InlineDiffTask) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(async e => {
        if (e.document.uri.toString() === task.originalFileUri.toString()) {
          // original file is changed
          if (e.document.getText() === task.replacementContent) {
            await this.taskManager.resetAndCleanHistory(task.id)
            this.taskManager.updateTaskState(task, InlineDiffTaskState.Accepted)
            this.taskChangeEmitter.fire(CodeEditTaskEntity.toJson(task))
          }

          task.lastKnownDocumentVersion = e.document.version
        }
      })
    )

    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument(async e => {
        const tmpFileUri = this.taskManager.getTempFileUri(task.id)
        if (e.uri.toString() === tmpFileUri?.toString()) {
          // tmp file or diff file is closed

          // compare original file and replacement content
          const originalFileContent = (
            await vscode.workspace.openTextDocument(task.originalFileUri)
          ).getText()

          if (originalFileContent === task.selectionContent) {
            // reject
            this.taskManager.updateTaskState(task, InlineDiffTaskState.Rejected)
            this.taskChangeEmitter.fire(CodeEditTaskEntity.toJson(task))
          } else {
            // accept or partial accept
            this.taskManager.updateTaskState(task, InlineDiffTaskState.Accepted)
            this.taskChangeEmitter.fire(CodeEditTaskEntity.toJson(task))
          }

          // clean history
          await this.taskManager.resetAndCleanHistory(task.id)
        }
      })
    )
  }

  dispose() {
    this.taskManager.dispose()
    this.taskChangeEmitter.dispose()
    this.disposables.forEach(d => d.dispose())
  }
}
