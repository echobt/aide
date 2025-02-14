import type { GetAgent } from '@extension/chat/strategies/_base'
import type { ConversationAction } from '@shared/entities'

import type { WebPreviewAgent } from './server/web-preview-agent'

export interface WebPreviewAgentState {}

export type WebPreviewAction = ConversationAction<
  WebPreviewAgentState,
  GetAgent<WebPreviewAgent>
>
