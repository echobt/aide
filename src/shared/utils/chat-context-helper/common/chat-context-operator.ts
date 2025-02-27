import {
  ChatContext,
  ChatContextEntity,
  ChatContextType,
  Conversation,
  type Agent
} from '@shared/entities'
import type { TFunction } from 'i18next'
import { produce } from 'immer'
import type { Updater } from 'use-immer'

import { ConversationOperator } from './conversation-operator'

export class ChatContextOperator {
  private context: ChatContext

  private setContext: Updater<ChatContext>

  constructor(context: ChatContext, setContext?: Updater<ChatContext>) {
    this.context = context
    this.setContext =
      setContext ||
      (updater => {
        if (typeof updater === 'function') {
          this.context = produce(this.context, draft => {
            updater(draft)
          })
        } else {
          this.context = updater
        }
      })
  }

  // Get the current context
  get(): ChatContext {
    return this.context
  }

  // Create a new chat context
  static createByType(
    t: TFunction,
    type: ChatContextType = ChatContextType.Chat
  ): ChatContextOperator {
    const context = new ChatContextEntity(t, { type }).entity
    return new ChatContextOperator(context)
  }

  // Add a new conversation
  addConversation(conversation: Conversation): ChatContext {
    this.setContext(draft => {
      draft.conversations.push(conversation)
      draft.updatedAt = Date.now()
      return draft
    })

    return this.get()
  }

  // Add multiple conversations
  addConversations(conversations: Conversation[]): ChatContext {
    this.setContext(draft => {
      draft.conversations.push(...conversations)
      draft.updatedAt = Date.now()
      return draft
    })

    return this.get()
  }

  // Remove a conversation by id
  removeConversation(conversationId: string): ChatContext {
    this.setContext(draft => {
      const index = draft.conversations.findIndex(c => c.id === conversationId)
      if (index !== -1) {
        draft.conversations.splice(index, 1)
        draft.updatedAt = Date.now()
      }
      return draft
    })

    return this.get()
  }

  // Update a conversation
  updateConversation(
    conversationId: string,
    updater: Updater<Conversation>
  ): ChatContext {
    this.setContext(draft => {
      const index = draft.conversations.findIndex(c => c.id === conversationId)

      if (index !== -1) {
        if (typeof updater === 'function') {
          updater(draft.conversations[index]!)
        } else {
          draft.conversations[index] = updater
        }
        draft.updatedAt = Date.now()
      }
      return draft
    })

    return this.get()
  }

  getSetConversationUpdater(conversationId: string): Updater<Conversation> {
    return updater => {
      this.setContext(draft => {
        const index = draft.conversations.findIndex(
          c => c.id === conversationId
        )

        if (index !== -1) {
          if (typeof updater === 'function') {
            updater(draft.conversations[index]!)
          } else {
            draft.conversations[index] = updater
          }
          draft.updatedAt = Date.now()
        }
        return draft
      })
    }
  }

  // Get conversation operator for a specific conversation
  getConversationOperator(conversationId: string): ConversationOperator | null {
    const conversation = this.context.conversations.find(
      c => c.id === conversationId
    )
    return conversation
      ? new ConversationOperator(
          conversation,
          this.getSetConversationUpdater(conversationId)
        )
      : null
  }

  // Get the last conversation operator
  getLastAvailableConversationOperator(): ConversationOperator | null {
    const lastConversation = [...this.context.conversations]
      .reverse()
      .find(c => !c.state.isFreeze)
    return lastConversation
      ? new ConversationOperator(
          lastConversation,
          this.getSetConversationUpdater(lastConversation.id)
        )
      : null
  }

  // Get the last human conversation operator
  getLastAvailableHumanConversationOperator(): ConversationOperator | null {
    const lastHumanConversation = [...this.context.conversations]
      .reverse()
      .find(c => c.role === 'human' && !c.state.isFreeze)
    return lastHumanConversation
      ? new ConversationOperator(
          lastHumanConversation,
          this.getSetConversationUpdater(lastHumanConversation.id)
        )
      : null
  }

  // Update settings
  updateSettings(updater: Updater<ChatContext['settings']>): ChatContext {
    this.setContext(draft => {
      if (typeof updater === 'function') {
        updater(draft.settings)
      } else {
        draft.settings = updater
      }
      draft.updatedAt = Date.now()
      return draft
    })

    return this.get()
  }

  // Convert to chat session
  toChatSession(t: TFunction) {
    return new ChatContextEntity(t, this.context).toChatSession(t)
  }
}

/**
 * Collects all thinkAgents from AI conversations following the conversation at startIndex,
 * until reaching the next human conversation or the end of the array
 */
export const collectThinkAgentsUntilNextHuman = (
  conversations: Conversation[],
  startIndex: number
): Agent[] => {
  const thinkAgents: Agent[] = []

  // Start from the next conversation
  for (let i = startIndex + 1; i < conversations.length; i++) {
    const conversation = conversations[i]!

    // Stop if we encounter another human message
    if (conversation.role === 'human') {
      break
    }

    // Collect thinkAgents from AI messages
    if (conversation.thinkAgents.length > 0) {
      thinkAgents.push(...conversation.thinkAgents)
    }
  }

  return thinkAgents
}
