import type { MentionComposerStrategyProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import { TerminalMentionChatStrategyProvider } from '../chat-strategy/terminal-mention-chat-strategy-provider'

export class TerminalMentionComposerStrategyProvider
  extends TerminalMentionChatStrategyProvider
  implements MentionComposerStrategyProvider {}
