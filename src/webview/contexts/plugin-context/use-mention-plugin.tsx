import { useMemo } from 'react'
import { useMentionPlugin } from '@webview/contexts/plugin-context/mention-plugin-context'
import type { MentionOption } from '@webview/types/chat'

export const useMentionPluginMentions = (): {
  typeMentionMap: Record<string, MentionOption>
  mentions: MentionOption[]
} => {
  const { mergeProviders } = useMentionPlugin()
  const useMentionOptions = mergeProviders('useMentionOptions')

  // eslint-disable-next-line react-compiler/react-compiler
  const _mentions = useMentionOptions!()
  const mentions = _mentions
    .filter(m => m.topLevelSort !== undefined && m.topLevelSort >= 0)
    .sort((a, b) => (a.topLevelSort ?? 0) - (b.topLevelSort ?? 0))

  const typeMentionMap = useMemo(
    () => buildTypeMentionMap(mentions),
    [mentions]
  )

  return { mentions, typeMentionMap }
}

const buildTypeMentionMap = (
  mentions: MentionOption[],
  typeMentionMap: Record<string, MentionOption> = {}
) => {
  for (const mention of mentions) {
    if (mention.type) {
      typeMentionMap[mention.type] = mention
    }

    if (Array.isArray(mention.children)) {
      buildTypeMentionMap(mention.children, typeMentionMap)
    }
  }
  return typeMentionMap
}
