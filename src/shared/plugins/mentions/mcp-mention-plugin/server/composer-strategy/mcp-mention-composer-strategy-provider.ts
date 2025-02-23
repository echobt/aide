import type { MentionComposerStrategyProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import { McpMentionChatStrategyProvider } from '../chat-strategy/mcp-mention-chat-strategy-provider'

export class McpMentionComposerStrategyProvider
  extends McpMentionChatStrategyProvider
  implements MentionComposerStrategyProvider {}
