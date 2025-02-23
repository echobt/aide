import type { MentionNoPromptStrategyProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import { DocMentionChatStrategyProvider } from '../chat-strategy/doc-mention-chat-strategy-provider'

export class DocMentionNoPromptStrategyProvider
  extends DocMentionChatStrategyProvider
  implements MentionNoPromptStrategyProvider {}
