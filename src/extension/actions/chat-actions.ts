import { ChatContextProcessor } from '@extension/chat'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { ChatContext, Conversation } from '@shared/entities'

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
}
