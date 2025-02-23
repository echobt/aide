import type { MentionNoPromptStrategyProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import { TerminalMentionChatStrategyProvider } from '../chat-strategy/terminal-mention-chat-strategy-provider'

export class TerminalMentionNoPromptStrategyProvider
  extends TerminalMentionChatStrategyProvider
  implements MentionNoPromptStrategyProvider {}
