import type { ChatContext } from '@shared/entities'
import type { MentionNoPromptStrategyProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import { FsMentionChatStrategyProvider } from '../chat-strategy/fs-mention-chat-strategy-provider'

export class FsMentionNoPromptStrategyProvider
  extends FsMentionChatStrategyProvider
  implements MentionNoPromptStrategyProvider
{
  async buildSystemMessagePrompt(chatContext: ChatContext): Promise<string> {
    return ''
  }
}
