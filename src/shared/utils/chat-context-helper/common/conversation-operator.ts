import type { MessageType } from '@langchain/core/messages'
import type {
  Agent,
  Conversation,
  ConversationContents,
  ConversationState,
  Mention
} from '@shared/entities'
import { ConversationEntity } from '@shared/entities'
import type { TFunction } from 'i18next'
import { produce } from 'immer'
import type { Updater } from 'use-immer'

export class ConversationOperator {
  private conversation: Conversation

  private setConversation: Updater<Conversation>

  constructor(
    conversation: Conversation,
    setConversation?: Updater<Conversation>
  ) {
    this.conversation = conversation
    this.setConversation =
      setConversation ||
      (updater => {
        if (typeof updater === 'function') {
          this.conversation = produce(this.conversation, draft => {
            updater(draft)
          })
        } else {
          this.conversation = updater
        }
      })
  }

  // Get the current conversation
  get(): Conversation {
    return this.conversation
  }

  // Create a new conversation
  static create(
    t: TFunction,
    role: MessageType = 'human'
  ): ConversationOperator {
    const conversation = new ConversationEntity(t, { role }).entity
    return new ConversationOperator(conversation)
  }

  // Check if conversation is frozen
  isFreeze(): boolean {
    return this.conversation.state.isFreeze
  }

  // Set freeze state
  setFreeze(freeze: boolean): Conversation {
    if (this.conversation.state.isFreeze === freeze) return this.get()

    this.setConversation(draft => {
      draft.state.isFreeze = freeze
      return draft
    })

    return this.get()
  }

  // Add content
  addContent(content: ConversationContents[number]): Conversation {
    if (this.isFreeze()) return this.get()

    this.setConversation(draft => {
      draft.contents.push(content)
      return draft
    })

    return this.get()
  }

  // Add multiple contents
  addContents(contents: ConversationContents): Conversation {
    if (this.isFreeze()) return this.get()

    this.setConversation(draft => {
      draft.contents.push(...contents)
      return draft
    })

    return this.get()
  }

  // Update content
  updateContent(
    index: number,
    content: Partial<ConversationContents[number]>
  ): Conversation {
    if (this.isFreeze()) return this.get()

    this.setConversation(draft => {
      if (draft.contents[index]) {
        Object.assign(draft.contents[index]!, content)
      }
      return draft
    })

    return this.get()
  }

  // Remove content
  removeContent(index: number): Conversation {
    if (this.isFreeze()) return this.get()

    this.setConversation(draft => {
      draft.contents.splice(index, 1)
      return draft
    })

    return this.get()
  }

  // Add mention
  addMention(mention: Mention): Conversation {
    if (this.isFreeze()) return this.get()

    this.setConversation(draft => {
      draft.mentions.push(mention)
      return draft
    })

    return this.get()
  }

  // Add multiple mentions
  addMentions(mentions: Mention[]): Conversation {
    if (this.isFreeze()) return this.get()

    this.setConversation(draft => {
      draft.mentions.push(...mentions)
      return draft
    })

    return this.get()
  }

  // Add agent
  addAgent(agent: Agent): Conversation {
    if (this.isFreeze()) return this.get()

    this.setConversation(draft => {
      if (!draft.agents) draft.agents = []

      draft.agents.push(agent)
      return draft
    })

    return this.get()
  }

  // Add multiple agents
  addAgents(agents: Agent[]): Conversation {
    if (this.isFreeze()) return this.get()

    this.setConversation(draft => {
      if (!draft.agents) draft.agents = []

      draft.agents.push(...agents)
      return draft
    })

    return this.get()
  }

  // Update state
  updateState(updater: (state: ConversationState) => void): Conversation {
    if (this.isFreeze()) return this.get()

    this.setConversation(draft => {
      updater(draft.state)
      return draft
    })

    return this.get()
  }

  // Set rich text
  setRichText(richText: string): Conversation {
    if (this.isFreeze()) return this.get()

    this.setConversation(draft => {
      draft.richText = richText
      return draft
    })

    return this.get()
  }
}
