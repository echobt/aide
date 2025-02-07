import type { MentionComposerStrategyProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import { GitMentionChatStrategyProvider } from '../chat-strategy/git-mention-chat-strategy-provider'

export class GitMentionComposerStrategyProvider
  extends GitMentionChatStrategyProvider
  implements MentionComposerStrategyProvider {}
