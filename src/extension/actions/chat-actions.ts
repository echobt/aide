import { ChatContextProcessor } from '@extension/chat'
import type { ConvertToPromptType } from '@extension/chat/strategies/_base'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { ChatContext, Conversation } from '@shared/entities'
import * as vscode from 'vscode'

export class ChatActionsCollection extends ServerActionCollection {
  readonly categoryName = 'chat'

  async *streamChat(
    context: ActionContext<{
      chatContext: ChatContext
    }>
  ): AsyncGenerator<Conversation[], void, unknown> {
    const { abortController, actionParams } = context
    const { chatContext } = actionParams
    const chatContextProcessor = new ChatContextProcessor(
      this.registerManager,
      this.commandManager
    )
    const answerStream = await chatContextProcessor.getAnswers(
      chatContext,
      abortController
    )

    for await (const conversations of answerStream) {
      yield conversations
    }
  }

  async copyPrompt(
    context: ActionContext<{
      type: ConvertToPromptType
      chatContext: ChatContext
    }>
  ): Promise<string> {
    const { abortController, actionParams } = context
    const { type, chatContext } = actionParams
    const chatContextProcessor = new ChatContextProcessor(
      this.registerManager,
      this.commandManager
    )
    const prompt = await chatContextProcessor.convertToPrompt(
      type,
      chatContext,
      abortController
    )

    vscode.env.clipboard.writeText(prompt)

    return prompt
  }
}
