import type { TFunction } from 'i18next'
import { v4 as uuidv4 } from 'uuid'

import { BaseEntity, type IBaseEntity } from './base-entity'
import {
  ConversationEntity,
  type ConversationContents,
  type ConversationState,
  type Mention
} from './conversation-entity'

export interface PromptSnippet extends IBaseEntity {
  title: string
  createdAt: number
  updatedAt: number
  contents: ConversationContents
  richText?: string // JSON stringified
  mentions: Mention[]
  state: ConversationState
}

export class PromptSnippetEntity extends BaseEntity<PromptSnippet> {
  protected getDefaults(
    t: TFunction,
    override?: Partial<PromptSnippet>
  ): PromptSnippet {
    const conversationEntity = new ConversationEntity(t).entity
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
      ...override
    }
  }
}
