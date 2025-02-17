import {
  ChatContext,
  ChatContextEntity,
  ChatContextType,
  Conversation
} from '@shared/entities'
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
    type: ChatContextType = ChatContextType.Chat
  ): ChatContextOperator {
    const context = new ChatContextEntity({ type }).entity
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
  toChatSession() {
    return new ChatContextEntity(this.context).toChatSession()
  }
}
