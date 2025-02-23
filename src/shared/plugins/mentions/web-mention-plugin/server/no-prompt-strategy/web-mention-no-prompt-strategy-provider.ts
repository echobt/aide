import type { MentionNoPromptStrategyProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import { WebMentionChatStrategyProvider } from '../chat-strategy/web-mention-chat-strategy-provider'

export class WebMentionNoPromptStrategyProvider
  extends WebMentionChatStrategyProvider
  implements MentionNoPromptStrategyProvider {}
