import { ModelProviderFactory } from '@extension/ai/model-providers/helpers/factory'
import { vfs } from '@extension/file-utils/vfs'
import { InlineDiffRegister } from '@extension/registers/inline-diff-register'
import { TaskEntity } from '@extension/registers/inline-diff-register/task-entity'
import type { InlineDiffTaskJson } from '@extension/registers/inline-diff-register/types'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { FeatureModelSettingKey } from '@shared/entities'
import { toUnixPath } from '@shared/utils/common'
import * as vscode from 'vscode'

export class ApplyActionsCollection extends ServerActionCollection {
  readonly categoryName = 'apply'

  private get inlineDiffProvider() {
    return this.registerManager?.getRegister(InlineDiffRegister)
      ?.inlineDiffProvider
  }

  async *createAndStartApplyCodeTask(
    context: ActionContext<{
      schemeUri: string
      code: string
      selectionRange?: vscode.Range
      cleanLast?: boolean
      onTaskChange?: (task: InlineDiffTaskJson) => void
    }>
  ): AsyncGenerator<InlineDiffTaskJson, void, unknown> {
    const { abortController, actionParams } = context
    const { schemeUri, code, selectionRange, cleanLast } = actionParams
    if (!schemeUri || !code || !this.inlineDiffProvider)
      throw new Error('createApplyCodeTask: Invalid parameters')

    const fullPath = await vfs.resolveFullPathProAsync(schemeUri, false)
    const originalCode = await vfs.readFilePro(fullPath)
    const taskId = fullPath

    if (cleanLast) {
      await this.inlineDiffProvider.resetAndCleanHistory(taskId)
    }

    const buildAiStream = async (abortController: AbortController) => {
      const modelProvider = await ModelProviderFactory.getModelProvider(
        FeatureModelSettingKey.ApplyFile
      )
      const aiModel = (await modelProvider.createLangChainModel()).bind({
        signal: abortController.signal
      })
      const aiStream = aiModel.stream([
        new SystemMessage(
          `
You are a code editor assistant. You are given a file path and a code snippet. You need to apply the code snippet to the file at the given path.
The file path is ${fullPath}.

The original code is:
${originalCode}

Your task is to apply the code snippet which from the user to the original code.
Don't reply with anything except the code.
`
        ),
        new HumanMessage(code)
      ])
      return aiStream
    }

    const uri =
      vscode.window.visibleTextEditors.find(
        editor => toUnixPath(editor.document.uri.fsPath) === fullPath
      )?.document.uri || vscode.Uri.file(fullPath)
    const document = await vscode.workspace.openTextDocument(uri)
    const fullRange = new vscode.Range(
      0,
      0,
      document.lineCount - 1,
      document.lineAt(document.lineCount - 1).text.length
    )
    const finalSelectionRange = selectionRange || fullRange

    this.inlineDiffProvider.taskChangeEmitter.event(task => {
      if (task.id === taskId) {
        context.actionParams.onTaskChange?.(task)
      }
    })

    yield TaskEntity.toJson(
      await this.inlineDiffProvider.createTask(
        taskId,
        uri,
        finalSelectionRange,
        '',
        abortController
      )
    )

    const streamTask = await this.inlineDiffProvider.startStreamTask(
      taskId,
      buildAiStream
    )

    for await (const task of streamTask) {
      yield TaskEntity.toJson(task)
    }
  }

  async refreshApplyCodeTask(
    context: ActionContext<{
      task: InlineDiffTaskJson
    }>
  ): Promise<InlineDiffTaskJson | null> {
    const { actionParams } = context
    const task = TaskEntity.fromJson({
      ...actionParams.task,
      abortController: context.abortController
    })

    if (!this.inlineDiffProvider)
      throw new Error('refreshApplyCodeTask: inlineDiffProvider not found')

    const finalTask = this.inlineDiffProvider.taskManager.getTask(task.id)
    if (!finalTask) return null

    return TaskEntity.toJson(finalTask)
  }

  async acceptApplyCodeTask(
    context: ActionContext<{
      task: InlineDiffTaskJson
    }>
  ): Promise<InlineDiffTaskJson> {
    const { actionParams } = context
    const task = TaskEntity.fromJson({
      ...actionParams.task,
      abortController: context.abortController
    })

    if (!this.inlineDiffProvider)
      throw new Error('acceptApplyCodeTask: inlineDiffProvider not found')

    return TaskEntity.toJson(await this.inlineDiffProvider.acceptAll(task))
  }

  async rejectApplyCodeTask(
    context: ActionContext<{
      task: InlineDiffTaskJson
    }>
  ): Promise<InlineDiffTaskJson> {
    const { actionParams } = context
    const task = TaskEntity.fromJson({
      ...actionParams.task,
      abortController: context.abortController
    })

    if (!this.inlineDiffProvider)
      throw new Error('rejectApplyCodeTask: inlineDiffProvider not found')

    return TaskEntity.toJson(await this.inlineDiffProvider.rejectAll(task))
  }

  async abortAndCleanApplyCodeTaskByPath(
    context: ActionContext<{ schemeUri: string }>
  ): Promise<void> {
    const { actionParams } = context
    const { schemeUri } = actionParams
    if (!schemeUri || !this.inlineDiffProvider)
      throw new Error('abortAndCleanApplyCodeTaskByPath: Invalid parameters')

    const taskId = await vfs.resolveFullPathProAsync(schemeUri, false)
    await this.inlineDiffProvider.resetAndCleanHistory(taskId)
  }

  async abortAndCleanApplyCodeTask(
    context: ActionContext<{
      task: InlineDiffTaskJson
    }>
  ): Promise<void> {
    const { actionParams } = context
    const task = TaskEntity.fromJson({
      ...actionParams.task,
      abortController: context.abortController
    })
    if (!this.inlineDiffProvider)
      throw new Error(
        'abortAndCleanApplyCodeTask: inlineDiffProvider not found'
      )

    await this.inlineDiffProvider.resetAndCleanHistory(task.id)
  }
}
