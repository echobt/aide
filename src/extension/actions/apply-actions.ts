import { ModelProviderFactory } from '@extension/ai/model-providers/helpers/factory'
import { vfs } from '@extension/file-utils/vfs'
import { CodeEditRegister } from '@extension/registers/code-edit-register'
import { CodeEditTaskEntity } from '@extension/registers/code-edit-register/task-entity'
import type {
  CodeEditTask,
  CodeEditTaskJson
} from '@extension/registers/code-edit-register/types'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { FeatureModelSettingKey } from '@shared/entities'
import { toUnixPath } from '@shared/utils/common'
import { t } from 'i18next'
import * as vscode from 'vscode'

type TaskParams = {
  task: CodeEditTaskJson
}

type CreateTaskParams = {
  sessionId: string
  conversationId: string
  agentId: string
  schemeUri: string
  selectionRange?: vscode.Range
  code?: string
  cleanLast?: boolean
}

type StartTaskParams = {
  task: CodeEditTaskJson
}

type CreateAndStartTaskParams = CreateTaskParams & Omit<StartTaskParams, 'task'>

export class ApplyActionsCollection extends ServerActionCollection {
  readonly categoryName = 'apply'

  // Getters
  private get codeEditProvider() {
    return this.registerManager?.getRegister(CodeEditRegister)?.codeEditProvider
  }

  // Validation methods
  private validateProvider() {
    if (!this.codeEditProvider) {
      throw new Error(t('extension.applyActions.codeEditProviderNotFound'))
    }
  }

  private validateSchemeUri(schemeUri: string) {
    if (!schemeUri) {
      throw new Error(t('extension.applyActions.invalidSchemeUriParameter'))
    }
  }

  // Utility methods
  private async getDocumentUri(fullPath: string): Promise<vscode.Uri> {
    const existingEditor = vscode.window.visibleTextEditors.find(
      editor => toUnixPath(editor.document.uri.fsPath) === fullPath
    )
    return existingEditor?.document.uri || vscode.Uri.file(fullPath)
  }

  private async getSelectionRange(
    uri: vscode.Uri,
    isNewFile: boolean,
    providedRange?: vscode.Range
  ): Promise<vscode.Range> {
    if (isNewFile) {
      return new vscode.Range(0, 0, 0, 0)
    }

    const document = await vscode.workspace.openTextDocument(uri)
    const fullRange = new vscode.Range(
      0,
      0,
      document.lineCount - 1,
      document.lineAt(document.lineCount - 1).text.length
    )
    return providedRange || fullRange
  }

  private async buildAiStream(
    fullPath: string,
    code: string,
    abortController: AbortController
  ) {
    const modelProvider = await ModelProviderFactory.getModelProvider(
      FeatureModelSettingKey.ApplyFile
    )
    const aiModel = (await modelProvider.createLangChainModel()).bind({
      signal: abortController.signal
    })

    const originalCode = await vfs.readFilePro(fullPath)
    const systemPrompt = `
You are a code editor assistant. You are given a file path and a code snippet. You need to apply the code snippet to the file at the given path.
The file path is ${fullPath}.

The original code is:
${originalCode}

Your task is to apply the code snippet which from the user to the original code.
Don't reply with anything except the code.
`

    return aiModel.stream([
      new SystemMessage(systemPrompt),
      new HumanMessage(code)
    ])
  }

  async createApplyCodeTask(
    context: ActionContext<CreateTaskParams>
  ): Promise<CodeEditTaskJson> {
    const {
      schemeUri,
      selectionRange,
      cleanLast,
      code,
      sessionId,
      conversationId,
      agentId
    } = context.actionParams
    this.validateProvider()
    this.validateSchemeUri(schemeUri)

    const fullPath = await vfs.resolveFullPathProAsync(schemeUri, false)
    const isNewFile = !(await vfs.isExists(fullPath))

    if (cleanLast) {
      await this.codeEditProvider!.cleanupTask(fullPath)
    }

    const uri = await this.getDocumentUri(fullPath)
    const finalSelectionRange = await this.getSelectionRange(
      uri,
      isNewFile,
      selectionRange
    )

    return CodeEditTaskEntity.toJson(
      await this.codeEditProvider!.createTask({
        sessionId,
        conversationId,
        agentId,
        fileUri: uri,
        selection: finalSelectionRange,
        isNewFile,
        newContent: code || '',
        abortController: new AbortController()
      })
    )
  }

  async *startApplyCodeTask(
    context: ActionContext<StartTaskParams>
  ): AsyncGenerator<CodeEditTaskJson, void, unknown> {
    const { abortController } = context
    const { task: taskJson } = context.actionParams

    const task = CodeEditTaskEntity.fromJson({
      ...taskJson,
      abortController
    })

    if (task.isNewFile) {
      yield* this.handleNewFileTask(task)
      return
    }
    const currentFileContent = await vfs.readFilePro(
      task.fileUri.fsPath,
      'utf-8'
    )
    if (currentFileContent !== task.originalContent) {
      // write original content to file (some times user has apply once and try re-apply, we need to restore the original content for show diff view)
      await vfs.writeFilePro(task.fileUri.fsPath, task.originalContent, 'utf-8')
    }

    yield* this.handleExistingFileTask(task)
  }

  async *createAndStartApplyCodeTask(
    context: ActionContext<CreateAndStartTaskParams>
  ): AsyncGenerator<CodeEditTaskJson, void, unknown> {
    const {
      sessionId,
      conversationId,
      agentId,
      schemeUri,
      selectionRange,
      code,
      cleanLast
    } = context.actionParams

    const task = await this.createApplyCodeTask({
      ...context,
      actionParams: {
        sessionId,
        conversationId,
        agentId,
        schemeUri,
        selectionRange,
        code,
        cleanLast
      }
    })

    yield task

    yield* this.startApplyCodeTask({
      ...context,
      actionParams: { task }
    })
  }

  private async *handleNewFileTask(task: CodeEditTask) {
    const streamTask = this.codeEditProvider!.streamEditContent(task, () =>
      Promise.reject(
        new Error(t('extension.applyActions.newFileDoesNotNeedAiStream'))
      )
    )

    for await (const updatedTask of streamTask) {
      yield CodeEditTaskEntity.toJson(updatedTask)
    }
  }

  private async *handleExistingFileTask(task: CodeEditTask) {
    const streamTask = this.codeEditProvider!.streamEditContent(
      task,
      (abortController: AbortController) =>
        this.buildAiStream(
          task.fileUri.fsPath,
          task.newContent,
          abortController
        )
    )

    for await (const updatedTask of streamTask) {
      yield CodeEditTaskEntity.toJson(updatedTask)
    }
  }

  async refreshApplyCodeTask(
    context: ActionContext<TaskParams>
  ): Promise<CodeEditTaskJson | null> {
    this.validateProvider()

    const task = CodeEditTaskEntity.fromJson(context.actionParams.task)
    const finalTask = this.codeEditProvider!.taskManager.getTask(task.id)

    return finalTask ? CodeEditTaskEntity.toJson(finalTask) : null
  }

  async acceptApplyCodeTask(
    context: ActionContext<TaskParams>
  ): Promise<CodeEditTaskJson> {
    this.validateProvider()

    const { actionParams, abortController } = context
    const task = CodeEditTaskEntity.fromJson({
      ...actionParams.task,
      abortController
    })

    return CodeEditTaskEntity.toJson(
      await this.codeEditProvider!.acceptChanges(task)
    )
  }

  async rejectApplyCodeTask(
    context: ActionContext<TaskParams>
  ): Promise<CodeEditTaskJson> {
    this.validateProvider()

    const { actionParams, abortController } = context
    const task = CodeEditTaskEntity.fromJson({
      ...actionParams.task,
      abortController
    })

    return CodeEditTaskEntity.toJson(
      await this.codeEditProvider!.rejectChanges(task)
    )
  }

  async abortAndCleanApplyCodeTaskByPath(
    context: ActionContext<{ schemeUri: string }>
  ): Promise<void> {
    this.validateProvider()

    const { schemeUri } = context.actionParams
    this.validateSchemeUri(schemeUri)

    const taskId = await vfs.resolveFullPathProAsync(schemeUri, false)
    await this.codeEditProvider!.cleanupTask(taskId)
  }

  async abortAndCleanApplyCodeTask(
    context: ActionContext<TaskParams>
  ): Promise<void> {
    this.validateProvider()

    const { actionParams, abortController } = context
    const task = CodeEditTaskEntity.fromJson({
      ...actionParams.task,
      abortController
    })

    await this.codeEditProvider!.cleanupTask(task.id)
  }
}
