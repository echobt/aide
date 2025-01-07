import type { UseMentionOptionsReturns } from '@shared/plugins/mentions/_base/client/mention-client-plugin-types'
import { useMentionPlugin } from '@webview/contexts/plugin-context/mention-plugin-context'

export const useMentionPluginMentionOptions = (): UseMentionOptionsReturns => {
  const { mergeProviders } = useMentionPlugin()
  const useMentionOptions = mergeProviders('useMentionOptions')

  // eslint-disable-next-line react-compiler/react-compiler
  return useMentionOptions!()
}
