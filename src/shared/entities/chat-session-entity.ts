import type { TFunction } from 'i18next'
import { v4 as uuidv4 } from 'uuid'

import { BaseEntity, type IBaseEntity } from './base-entity'
import { ChatContextType } from './chat-context-entity'

export interface ChatSession extends IBaseEntity {
  type: ChatContextType
  createdAt: number
  updatedAt: number
  title: string
}

export class ChatSessionEntity extends BaseEntity<ChatSession> {
  protected getDefaults(
    t: TFunction,
    override?: Partial<ChatSession>
  ): ChatSession {
    const now = Date.now()
    return {
      id: uuidv4(),
      type: ChatContextType.Chat,
      createdAt: now,
      updatedAt: now,
      title: t('shared.entities.chatSession.defaultTitle'),
      ...override
    }
  }
}
