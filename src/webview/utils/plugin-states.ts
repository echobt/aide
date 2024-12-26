import type { MentionOption } from '@webview/types/chat'

export const findMentionOptionByMentionType = (
  mentionOptions: MentionOption[],
  mentionType: string
): MentionOption | undefined => {
  for (const option of mentionOptions) {
    if (option.children) {
      const found = findMentionOptionByMentionType(option.children, mentionType)
      if (found) {
        return found
      }
    }

    if (option.type === mentionType) {
      return option
    }
  }

  return undefined
}
