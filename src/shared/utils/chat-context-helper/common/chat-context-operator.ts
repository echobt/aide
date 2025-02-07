import {
  ChatContext,
  ChatContextEntity,
  ChatContextType,
  Conversation
} from '@shared/entities'
import { produce } from 'immer'

import { ConversationOperator } from './conversation-operator'

export class ChatContextOperator {
  private context: ChatContext

  constructor(context: ChatContext) {
    this.context = context
  }

  // Get the current context
  get(): ChatContext {
    return this.context
  }

  // Create a new operator instance with updated context
  private withContext(
    updater: (context: ChatContext) => ChatContext
  ): ChatContextOperator {
    return new ChatContextOperator(updater(this.context))
  }

  // Create a new chat context
  static create(
    type: ChatContextType = ChatContextType.Chat
  ): ChatContextOperator {
    const context = new ChatContextEntity({ type }).entity
    return new ChatContextOperator(context)
  }

  // Add a new conversation
  addConversation(conversation: Conversation): ChatContextOperator {
    return this.withContext(
      produce(draft => {
        draft.conversations.push(conversation)
        draft.updatedAt = Date.now()
        return draft
      })
    )
  }

  // Add multiple conversations
  addConversations(conversations: Conversation[]): ChatContextOperator {
    return this.withContext(
      produce(draft => {
        draft.conversations.push(...conversations)
        draft.updatedAt = Date.now()
        return draft
      })
    )
  }

  // Remove a conversation by id
  removeConversation(conversationId: string): ChatContextOperator {
    return this.withContext(
      produce(draft => {
        const index = draft.conversations.findIndex(
          c => c.id === conversationId
        )
        if (index !== -1) {
          draft.conversations.splice(index, 1)
          draft.updatedAt = Date.now()
        }
        return draft
      })
    )
  }

  // Update a conversation
  updateConversation(
    conversationId: string,
    updater: (conversation: Conversation) => void
  ): ChatContextOperator {
    return this.withContext(
      produce(draft => {
        const conversation = draft.conversations.find(
          c => c.id === conversationId
        )
        if (conversation) {
          updater(conversation)
          draft.updatedAt = Date.now()
        }
        return draft
      })
    )
  }

  // Get conversation operator for a specific conversation
  getConversationOperator(conversationId: string): ConversationOperator | null {
    const conversation = this.context.conversations.find(
      c => c.id === conversationId
    )
    return conversation ? new ConversationOperator(conversation) : null
  }

  // Get the last conversation operator
  getLastAvailableConversationOperator(): ConversationOperator | null {
    const lastConversation = [...this.context.conversations]
      .reverse()
      .find(c => !c.state.isFreeze)
    return lastConversation ? new ConversationOperator(lastConversation) : null
  }

  // Get the last human conversation operator
  getLastAvailableHumanConversationOperator(): ConversationOperator | null {
    const lastHumanConversation = [...this.context.conversations]
      .reverse()
      .find(c => c.role === 'human' && !c.state.isFreeze)
    return lastHumanConversation
      ? new ConversationOperator(lastHumanConversation)
      : null
  }

  // Update settings
  updateSettings(
    updater: (settings: ChatContext['settings']) => void
  ): ChatContextOperator {
    return this.withContext(
      produce(draft => {
        updater(draft.settings)
        draft.updatedAt = Date.now()
        return draft
      })
    )
  }

  // Convert to chat session
  toChatSession() {
    return new ChatContextEntity(this.context).toChatSession()
  }
}
