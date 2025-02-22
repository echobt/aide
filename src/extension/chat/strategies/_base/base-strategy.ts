import type { CommandManager } from '@extension/commands/command-manager'
import { logger } from '@extension/logger'
import type { RegisterManager } from '@extension/registers/register-manager'
import { runAction } from '@extension/state'
import type { ChatContext, Conversation } from '@shared/entities'
import { cloneDeep } from 'es-toolkit'
import { produce } from 'immer'

import { baseGraphStateEventName, type BaseGraphState } from './base-state'

export interface BaseStrategyOptions {
  registerManager: RegisterManager
  commandManager: CommandManager
}

export abstract class BaseStrategy<State extends BaseGraphState> {
  protected registerManager: RegisterManager

  protected commandManager: CommandManager

  constructor(options: BaseStrategyOptions) {
    this.registerManager = options.registerManager
    this.commandManager = options.commandManager
  }

  protected abstract getWorkflow(): Promise<any>

  async *getAnswers(
    chatContext: ChatContext,
    abortController?: AbortController
  ): AsyncGenerator<Conversation[], void, unknown> {
    const workflow = await this.getWorkflow()
    const graph = workflow.compile()

    const eventStream = await graph.streamEvents(
      {
        chatContext,
        abortController
      },
      { version: 'v2' }
    )

    const state = {} as State

    try {
      for await (const { event, name, data } of eventStream) {
        if (event === 'on_custom_event' && name === baseGraphStateEventName) {
          const returnsState = data
          Object.assign(state, returnsState)
          const newConversations = (state.newConversations ?? []).map(
            conversation =>
              produce(conversation, draft => {
                draft.state.isGenerating = true
              })
          )

          yield newConversations
        }
      }

      const newConversations = (state.newConversations ?? []).map(
        conversation =>
          produce(conversation, draft => {
            draft.state.isGenerating = false
          })
      )
      yield newConversations
    } finally {
      const contextId = state.chatContext?.id
      if (contextId) {
        await this.updateSessionState(contextId, state)
      }
    }
  }

  protected async updateSessionState(
    contextId: string,
    state: State
  ): Promise<void> {
    try {
      const newConversations = cloneDeep(state.newConversations ?? [])

      await runAction(
        this.registerManager
      ).server.chatSession.partialUpdateSession({
        actionParams: {
          sessionId: contextId,
          chatContextUpdater(draft) {
            newConversations?.forEach(conversation => {
              const index = draft.conversations.findIndex(
                c => c.id === conversation.id
              )

              if (index === -1) {
                draft.conversations.push(conversation)
              } else {
                // only update if the content, other state may be updated by client
                draft.conversations[index]!.contents = conversation.contents
              }
            })

            draft.conversations.forEach(conversation => {
              conversation.state.isGenerating = false
            })
          }
        }
      })
    } catch (error) {
      // user may be deleted the session
      logger.warn('Failed to update session state', error)
    }
  }
}
