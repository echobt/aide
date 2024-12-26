import { v4 as uuidv4 } from 'uuid'

import { BaseEntity, type IBaseEntity } from './base-entity'
import {
  ConversationEntity,
  type ConversationState,
  type LangchainMessageContents,
  type Mention
} from './conversation-entity'

export interface PromptSnippet extends IBaseEntity {
  title: string
  createdAt: number
  updatedAt: number
  contents: LangchainMessageContents
  richText?: string // JSON stringified
  mentions: Mention[]
  state: ConversationState
}

export class PromptSnippetEntity extends BaseEntity<PromptSnippet> {
  protected getDefaults(data?: Partial<PromptSnippet>): PromptSnippet {
    const conversationEntity = new ConversationEntity().entity
    const { contents, mentions, state } = conversationEntity
    const now = Date.now()

    return {
      id: uuidv4(),
      title: 'Untitled Prompt Snippet',
      createdAt: now,
      updatedAt: now,
      contents,
      mentions,
      state,
      ...data
    }
  }
}
