import { defaultPresetName } from '@extension/registers/webvm-register/presets/_base/constants'
import type { TFunction } from 'i18next'
import { v4 as uuidv4 } from 'uuid'

import { BaseEntity, type IBaseEntity } from './base-entity'
import { ChatSessionEntity, type ChatSession } from './chat-session-entity'
import { type Conversation } from './conversation-entity'

export interface ChatContext extends IBaseEntity {
  type: ChatContextType
  createdAt: number
  updatedAt: number
  conversations: Conversation[]
  settings: SettingsContext
}

export class ChatContextEntity extends BaseEntity<ChatContext> {
  getDefaults(t: TFunction, override?: Partial<ChatContext>): ChatContext {
    const now = Date.now()
    return {
      id: uuidv4(),
      type: ChatContextType.Chat,
      createdAt: now,
      updatedAt: now,
      conversations: [],
      settings: {
        defaultV1PresetName: defaultPresetName
      },
      ...override
    }
  }

  toChatSession(t: TFunction): ChatSession {
    const { entity } = this

    return new ChatSessionEntity(t, {
      id: entity.id,
      title: this.getTitleFromConversations(
        entity.conversations,
        t('shared.entities.chatContext.defaultTitle')
      ),
      type: entity.type,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    }).entity
  }

  private getTitleFromConversations = (
    conversations: Conversation[],
    defaultTitle: string
  ) => {
    let firstHumanMessageText = ''

    conversations
      .filter(conversation => conversation.role === 'human')
      .forEach(conversation =>
        conversation.contents.forEach(content => {
          if (content.type === 'text' && !firstHumanMessageText) {
            firstHumanMessageText = content.text
          }
        })
      )

    return firstHumanMessageText || defaultTitle
  }
}

export interface SettingsContext {
  defaultV1PresetName: string
}

export enum ChatContextType {
  Chat = 'chat',
  Composer = 'composer',
  V1 = 'v1',
  Agent = 'auto-task',
  NoPrompt = 'no-prompt'
}
