import type { Agent } from '@shared/entities'
import type { MentionOption } from '@webview/types/chat'

export type UseMentionOptionsReturns = MentionOption[]

export type CustomRenderLogPreviewProps = {
  agent: Agent
}

export type MentionClientPluginProviderMap = {
  useMentionOptions: () => UseMentionOptionsReturns
}
