/* eslint-disable @typescript-eslint/no-useless-constructor */
import { runAction } from '@extension/state'
import type { ChatContext, Conversation } from '@shared/entities'
import type { UnPromise } from '@shared/types/common'
import { produce } from 'immer'

import { baseGraphStateEventName, BaseStrategy } from '../_base'
import { createComposerWorkflow } from './composer-workflow'
import type { ComposerGraphState } from './state'

export class ComposerStrategy extends BaseStrategy {
  private _composerWorkflow: UnPromise<
    ReturnType<typeof createComposerWorkflow>
  > | null = null

  private getComposerWorkflow = async () => {
    if (!this._composerWorkflow) {
      this._composerWorkflow = await createComposerWorkflow({
        registerManager: this.registerManager,
        commandManager: this.commandManager
      })
    }

    return this._composerWorkflow
  }

  async *getAnswers(
    chatContext: ChatContext,
    abortController?: AbortController
  ): AsyncGenerator<Conversation[], void, unknown> {
    const composerWorkflow = await this.getComposerWorkflow()
    const graph = composerWorkflow.compile()

    const eventStream = await graph.streamEvents(
      {
        chatContext,
        abortController
      },
      { version: 'v2' }
    )

    const state: Partial<ComposerGraphState> = {}
    let newChatContext: ChatContext | null = null

    for await (const { event, name, data } of eventStream) {
      if (event === 'on_custom_event' && name === baseGraphStateEventName) {
        const returnsState = data as Partial<ComposerGraphState>
        Object.assign(state, returnsState)
        const currentChatContext = state.chatContext || chatContext

        if (state.newConversations?.length) {
          newChatContext = produce(currentChatContext, draft => {
            draft.conversations.push(...(state.newConversations ?? []))
          })

          yield newChatContext.conversations
        }
      }
    }

    if (newChatContext) {
      await runAction(this.registerManager).server.chatSession.updateSession({
        actionParams: {
          chatContext: newChatContext
        }
      })
    }
  }
}
