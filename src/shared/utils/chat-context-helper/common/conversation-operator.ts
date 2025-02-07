import type { MessageType } from '@langchain/core/messages'
import type {
  Agent,
  Conversation,
  ConversationAction,
  ConversationContents,
  ConversationState,
  Mention
} from '@shared/entities'
import { ConversationEntity } from '@shared/entities'
import { produce } from 'immer'

export class ConversationOperator {
  private conversation: Conversation

  constructor(conversation: Conversation) {
    this.conversation = conversation
  }

  // Get the current conversation
  get(): Conversation {
    return this.conversation
  }

  // Create a new operator instance with updated conversation
  private withConversation(
    updater: (conversation: Conversation) => Conversation
  ): ConversationOperator {
    return new ConversationOperator(updater(this.conversation))
  }

  // Create a new conversation
  static create(role: MessageType = 'human'): ConversationOperator {
    const conversation = new ConversationEntity({ role }).entity
    return new ConversationOperator(conversation)
  }

  // Check if conversation is frozen
  isFreeze(): boolean {
    return this.conversation.state.isFreeze
  }

  // Set freeze state
  setFreeze(freeze: boolean): ConversationOperator {
    if (this.conversation.state.isFreeze === freeze) return this

    return this.withConversation(
      produce(draft => {
        draft.state.isFreeze = freeze
        return draft
      })
    )
  }

  // Add content
  addContent(content: ConversationContents[number]): ConversationOperator {
    if (this.isFreeze()) return this

    return this.withConversation(
      produce(draft => {
        draft.contents.push(content)
        return draft
      })
    )
  }

  // Add multiple contents
  addContents(contents: ConversationContents): ConversationOperator {
    if (this.isFreeze()) return this

    return this.withConversation(
      produce(draft => {
        draft.contents.push(...contents)
        return draft
      })
    )
  }

  // Update content
  updateContent(
    index: number,
    content: Partial<ConversationContents[number]>
  ): ConversationOperator {
    if (this.isFreeze()) return this

    return this.withConversation(
      produce(draft => {
        if (draft.contents[index]) {
          Object.assign(draft.contents[index]!, content)
        }
        return draft
      })
    )
  }

  // Remove content
  removeContent(index: number): ConversationOperator {
    if (this.isFreeze()) return this

    return this.withConversation(
      produce(draft => {
        draft.contents.splice(index, 1)
        return draft
      })
    )
  }

  // Add mention
  addMention(mention: Mention): ConversationOperator {
    if (this.isFreeze()) return this

    return this.withConversation(
      produce(draft => {
        draft.mentions.push(mention)
        return draft
      })
    )
  }

  // Add multiple mentions
  addMentions(mentions: Mention[]): ConversationOperator {
    if (this.isFreeze()) return this

    return this.withConversation(
      produce(draft => {
        draft.mentions.push(...mentions)
        return draft
      })
    )
  }

  // Add agent
  addAgent(agent: Agent): ConversationOperator {
    if (this.isFreeze()) return this

    return this.withConversation(
      produce(draft => {
        draft.thinkAgents.push(agent)
        return draft
      })
    )
  }

  // Add multiple agents
  addAgents(agents: Agent[]): ConversationOperator {
    if (this.isFreeze()) return this

    return this.withConversation(
      produce(draft => {
        draft.thinkAgents.push(...agents)
        return draft
      })
    )
  }

  // Add action
  addAction(action: ConversationAction): ConversationOperator {
    if (this.isFreeze()) return this

    return this.withConversation(
      produce(draft => {
        draft.actions.push(action)
        return draft
      })
    )
  }

  // Update state
  updateState(
    updater: (state: ConversationState) => void
  ): ConversationOperator {
    if (this.isFreeze()) return this

    return this.withConversation(
      produce(draft => {
        updater(draft.state)
        return draft
      })
    )
  }

  // Set rich text
  setRichText(richText: string): ConversationOperator {
    if (this.isFreeze()) return this

    return this.withConversation(
      produce(draft => {
        draft.richText = richText
        return draft
      })
    )
  }
}
