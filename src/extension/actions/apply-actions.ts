import { ModelProviderFactory } from '@extension/ai/model-providers/helpers/factory'
import { VsCodeFS } from '@extension/file-utils/vscode-fs'
import { InlineDiffRegister } from '@extension/registers/inline-diff-register'
import type { InlineDiffTask } from '@extension/registers/inline-diff-register/types'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { FeatureModelSettingKey } from '@shared/entities'
import * as vscode from 'vscode'

export class ApplyActionsCollection extends ServerActionCollection {
  readonly categoryName = 'apply'

  private get inlineDiffProvider() {
    return this.registerManager?.getRegister(InlineDiffRegister)
      ?.inlineDiffProvider
  }

  async *applyCode(
    context: ActionContext<{
      path: string
      code: string
      selectionRange?: vscode.Range
      cleanLast?: boolean
    }>
  ): AsyncGenerator<InlineDiffTask, void, unknown> {
    const { abortController, actionParams } = context
    const { path, code, selectionRange, cleanLast } = actionParams
    if (!path || !code || !this.inlineDiffProvider) return

    const originalCode = await VsCodeFS.readFileOrOpenDocumentContent(path)
    const taskId = path

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
The file path is ${path}.

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
        editor => editor.document.uri.toString() === path
      )?.document.uri || vscode.Uri.file(path)
    const document = await vscode.workspace.openTextDocument(uri)
    const fullRange = new vscode.Range(
      0,
      0,
      document.lineCount - 1,
      document.lineAt(document.lineCount - 1).text.length
    )
    const finalSelectionRange = selectionRange || fullRange

    await this.inlineDiffProvider.createTask(
      taskId,
      uri,
      finalSelectionRange,
      '',
      abortController
    )

    yield* this.inlineDiffProvider.startStreamTask(taskId, buildAiStream)
  }

  async interruptApplyCode(
    context: ActionContext<{ path: string }>
  ): Promise<void> {
    const { actionParams } = context
    const { path } = actionParams
    if (!path || !this.inlineDiffProvider) return

    const taskId = path
    await this.inlineDiffProvider.resetAndCleanHistory(taskId)
  }
}
