import { type MessageContentComplex } from '@langchain/core/messages'
import type { ConversationContents, LangchainMessage } from '@shared/entities'
import { hasOwnProperty } from '@shared/utils/common'

export const parseAsConversationContents = (
  content:
    | string
    | MessageContentComplex[]
    | MessageContentComplex
    | LangchainMessage
    | undefined
    | null
): ConversationContents => {
  const defaultContent: ConversationContents = []

  if (!content) {
    return defaultContent
  }

  if (Array.isArray(content)) {
    return content
      .map(item => {
        const itemResult = parseAsConversationContents(item)
        return itemResult
      })
      .flat()
  }

  if (typeof content === 'string') {
    return [
      {
        type: 'text',
        text: content
      }
    ]
  }

  if (typeof content === 'object' && content !== null) {
    if (hasOwnProperty<MessageContentComplex>(content, 'type')) {
      if (content.type === 'text') {
        return [
          {
            type: 'text',
            text: content.text
          }
        ]
      }

      if (content.type === 'image_url') {
        return [
          {
            type: 'image_url',
            image_url: {
              url:
                typeof content.image_url === 'string'
                  ? content.image_url
                  : content.image_url?.url,
              detail: content?.image_url?.detail || undefined
            }
          }
        ]
      }

      if (content.type === 'action') {
        return [
          {
            type: 'action',
            actionId: content.actionId
          }
        ]
      }
    } else if (hasOwnProperty<LangchainMessage>(content, 'getType')) {
      return parseAsConversationContents(content.content)
    }
  }

  return defaultContent
}
