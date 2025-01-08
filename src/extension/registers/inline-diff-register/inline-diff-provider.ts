import type { AIMessageChunk } from '@langchain/core/messages'
import type { IterableReadableStream } from '@langchain/core/utils/stream'
import { v4 as uuidv4 } from 'uuid'
import * as vscode from 'vscode'

import { DecorationManager } from './decoration-manager'
import { DiffProcessor } from './diff-processor'
import { TaskEntity } from './task-entity'
import { TaskManager } from './task-manager'
import {
  InlineDiffTaskState,
  type DiffBlock,
  type InlineDiffTask,
  type InlineDiffTaskJson
} from './types'

export class InlineDiffProvider implements vscode.CodeLensProvider {
  taskManager: TaskManager

  private diffProcessor: DiffProcessor

  private decorationManager: DecorationManager

  private codeLensEventEmitter: vscode.EventEmitter<void>

  taskChangeEmitter: vscode.EventEmitter<InlineDiffTaskJson> =
    new vscode.EventEmitter<InlineDiffTaskJson>()

  constructor() {
    this.diffProcessor = new DiffProcessor()
    this.decorationManager = new DecorationManager(this.diffProcessor)
    this.taskManager = new TaskManager(
      this.diffProcessor,
      this.decorationManager
    )
    this.codeLensEventEmitter = this.taskManager.codeLensChangeEmitter
  }

  get onDidChangeCodeLenses(): vscode.Event<void> {
    return this.codeLensEventEmitter.event
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

  async startTask(taskId: string): Promise<void> {
    await this.taskManager.startTask(taskId)
  }

  async *startStreamTask(
    taskId: string,
    buildAiStream: (
      abortController: AbortController
    ) => Promise<IterableReadableStream<AIMessageChunk>>
  ): AsyncGenerator<InlineDiffTask> {
    yield* await this.taskManager.startStreamTask(taskId, buildAiStream)
  }

  async provideCodeLenses(
    document: vscode.TextDocument
  ): Promise<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = []
    for (const task of this.taskManager.getAllTasks()) {
      if (
        document.uri.toString() !== task.originalFileUri.toString() ||
        [InlineDiffTaskState.Accepted, InlineDiffTaskState.Rejected].includes(
          task.state
        )
      ) {
        continue
      }

      const blocksWithRange =
        await this.diffProcessor.getDiffBlocksWithDisplayRange(task)
      const { range: diffRange } = await this.diffProcessor.buildDiffContent(
        task,
        blocksWithRange
      )
      const topRange = new vscode.Range(
        new vscode.Position(diffRange.start.line, 0),
        new vscode.Position(diffRange.start.line, 0)
      )
      const actionId = uuidv4()

      if (task.state === InlineDiffTaskState.Error) {
        codeLenses.push(
          new vscode.CodeLens(topRange, {
            title: `$(error) Error applying diff`,
            command: 'aide.inlineDiff.showError',
            arguments: [task]
          })
        )
        continue
      }

      if (task.state === InlineDiffTaskState.Generating) {
        codeLenses.push(
          new vscode.CodeLens(topRange, {
            title: '$(sync~spin) Aide is working...',
            command: ''
          })
        )
        continue
      }

      if (task.state === InlineDiffTaskState.Reviewing) {
        codeLenses.push(
          new vscode.CodeLens(topRange, {
            title: '$(check) Accept All',
            command: 'aide.inlineDiff.acceptAll',
            arguments: [task, actionId]
          })
        )

        codeLenses.push(
          new vscode.CodeLens(topRange, {
            title: '$(x) Reject All',
            command: 'aide.inlineDiff.rejectAll',
            arguments: [task, actionId]
          })
        )

        for (let i = 0; i < task.diffBlocks.length; i++) {
          const block = task.diffBlocks[i]!
          if (!task.waitForReviewDiffBlockIds.includes(block.id)) {
            continue
          }

          const nextBlock = task.diffBlocks[i + 1]
          const isRemoveAddPair =
            block.type === 'remove' &&
            nextBlock?.type === 'add' &&
            task.waitForReviewDiffBlockIds.includes(nextBlock.id)
          const range = await this.diffProcessor.getDiffBlockDisplayRange(
            blocksWithRange,
            block
          )

          if (isRemoveAddPair) {
            codeLenses.push(
              new vscode.CodeLens(range, {
                title: '$(check) Accept',
                command: 'aide.inlineDiff.accept',
                arguments: [task, [block, nextBlock], actionId]
              })
            )

            codeLenses.push(
              new vscode.CodeLens(range, {
                title: '$(x) Reject',
                command: 'aide.inlineDiff.reject',
                arguments: [task, [block, nextBlock], actionId]
              })
            )

            i++
          } else if (block.type !== 'no-change') {
            codeLenses.push(
              new vscode.CodeLens(range, {
                title: '$(check) Accept',
                command: 'aide.inlineDiff.accept',
                arguments: [task, [block], actionId]
              })
            )

            codeLenses.push(
              new vscode.CodeLens(range, {
                title: '$(x) Reject',
                command: 'aide.inlineDiff.reject',
                arguments: [task, [block], actionId]
              })
            )
          }
        }
      }
    }

    return codeLenses
  }

  async acceptDiffs(
    task: InlineDiffTask,
    blocks: DiffBlock[],
    actionId = uuidv4(),
    emitChange = true
  ) {
    const finalTask = this.taskManager.getTask(task.id) || task
    await this.taskManager.acceptDiffs(finalTask, blocks, actionId)

    if (emitChange) this.taskChangeEmitter.fire(TaskEntity.toJson(task))
  }

  async rejectDiffs(
    task: InlineDiffTask,
    blocks: DiffBlock[],
    actionId = uuidv4(),
    emitChange = true
  ) {
    const finalTask = this.taskManager.getTask(task.id) || task
    await this.taskManager.rejectDiffs(finalTask, blocks, actionId)

    if (emitChange) this.taskChangeEmitter.fire(TaskEntity.toJson(task))
  }

  async acceptAll(task: InlineDiffTask, actionId = uuidv4()) {
    await this.acceptDiffs(task, task.diffBlocks, actionId, false)
    this.taskManager.updateTaskState(task, InlineDiffTaskState.Accepted)
    this.taskChangeEmitter.fire(TaskEntity.toJson(task))
    return task
  }

  async rejectAll(task: InlineDiffTask, actionId = uuidv4()) {
    await this.rejectDiffs(task, task.diffBlocks, actionId, false)
    this.taskManager.updateTaskState(task, InlineDiffTaskState.Rejected)
    this.taskChangeEmitter.fire(TaskEntity.toJson(task))
    return task
  }

  async resetAndCleanHistory(taskId: string) {
    await this.taskManager.resetAndCleanHistory(taskId)
  }

  dispose() {
    this.codeLensEventEmitter.dispose()
    this.taskManager.dispose()
    this.decorationManager.dispose()
    this.diffProcessor.dispose()
    this.taskChangeEmitter.dispose()
  }
}
