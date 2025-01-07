import type { ConversationContents } from '@shared/entities'

export const getAllTextFromConversationContents = (
  contents: ConversationContents
): string =>
  contents
    .map(content => {
      if (content.type === 'text') {
        return content.text
      }
      return ''
    })
    .join('')
