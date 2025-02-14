import { runAction } from '@extension/state'
import { type ChatContext, type Conversation } from '@shared/entities'
import { UnPromise } from '@shared/types/common'
import { produce } from 'immer'

import { baseGraphStateEventName } from '../_base/base-state'
import { BaseStrategy } from '../_base/base-strategy'
import { createChatWorkflow } from './chat-workflow'
import { type ChatGraphState } from './state'

export class ChatStrategy extends BaseStrategy {
  private _chatWorkflow: UnPromise<
    ReturnType<typeof createChatWorkflow>
  > | null = null

  private getChatWorkflow = async () => {
    if (!this._chatWorkflow) {
      this._chatWorkflow = await createChatWorkflow({
        registerManager: this.registerManager,
        commandManager: this.commandManager
      })
    }

    return this._chatWorkflow
  }

  async *getAnswers(
    chatContext: ChatContext,
    abortController?: AbortController
  ): AsyncGenerator<Conversation[], void, unknown> {
    const chatWorkflow = await this.getChatWorkflow()
    const graph = chatWorkflow.compile()

    const eventStream = await graph.streamEvents(
      {
        chatContext,
        abortController
      },
      { version: 'v2' }
    )

    const state: Partial<ChatGraphState> = {}
    let newChatContext: ChatContext | null = null

    try {
      for await (const { event, name, data } of eventStream) {
        if (event === 'on_custom_event' && name === baseGraphStateEventName) {
          const returnsState = data as Partial<ChatGraphState>
          Object.assign(state, returnsState)
          const currentChatContext = state.chatContext || chatContext
          const newConversations = (state.newConversations ?? []).map(
            conversation =>
              produce(conversation, draft => {
                draft.state.isGenerating = true
              })
          )

          if (newConversations.length) {
            newChatContext = produce(currentChatContext, draft => {
              draft.conversations.push(...newConversations)
            })

            yield newChatContext.conversations
          }
        }
      }
    } finally {
      if (newChatContext) {
        await runAction(this.registerManager).server.chatSession.updateSession({
          actionParams: {
            chatContext: produce(newChatContext, draft => {
              draft.conversations.forEach(conversation => {
                conversation.state.isGenerating = false
              })
            })
          }
        })
      }
    }
  }
}
