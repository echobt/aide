import { runAction } from '@extension/state'
import { type ChatContext, type Conversation } from '@shared/entities'
import { UnPromise } from '@shared/types/common'
import { produce } from 'immer'

import { baseGraphStateEventName } from '../_base/base-state'
import { BaseStrategy } from '../_base/base-strategy'
import type { V1GraphState } from './state'
import { createV1Workflow } from './v1-workflow'

export class V1Strategy extends BaseStrategy {
  private _v1Workflow: UnPromise<ReturnType<typeof createV1Workflow>> | null =
    null

  private getV1Workflow = async () => {
    if (!this._v1Workflow) {
      this._v1Workflow = await createV1Workflow({
        registerManager: this.registerManager,
        commandManager: this.commandManager
      })
    }

    return this._v1Workflow
  }

  async *getAnswers(
    chatContext: ChatContext,
    abortController?: AbortController
  ): AsyncGenerator<Conversation[], void, unknown> {
    const v1Workflow = await this.getV1Workflow()
    const graph = v1Workflow.compile()

    const eventStream = await graph.streamEvents(
      {
        chatContext,
        abortController
      },
      { version: 'v2' }
    )

    const state: Partial<V1GraphState> = {}
    let newChatContext: ChatContext | null = null

    try {
      for await (const { event, name, data } of eventStream) {
        if (event === 'on_custom_event' && name === baseGraphStateEventName) {
          const returnsState = data as Partial<V1GraphState>
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
