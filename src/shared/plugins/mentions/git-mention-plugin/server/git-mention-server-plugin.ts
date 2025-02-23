import type {
  MentionServerPlugin,
  MentionServerPluginContext
} from '@shared/plugins/mentions/_base/server/mention-server-plugin-context'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'

import { GitMentionChatStrategyProvider } from './chat-strategy/git-mention-chat-strategy-provider'
import { GitMentionComposerStrategyProvider } from './composer-strategy/git-mention-composer-strategy-provider'
import { GitMentionServerUtilsProvider } from './git-mention-server-utils-provider'
import { GitMentionNoPromptStrategyProvider } from './no-prompt-strategy/git-mention-no-prompt-strategy-provider'

export class GitMentionServerPlugin implements MentionServerPlugin {
  id = MentionPluginId.Git

  version: string = pkg.version

  private context: MentionServerPluginContext | null = null

  async activate(context: MentionServerPluginContext): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'chatStrategy',
      () => new GitMentionChatStrategyProvider()
    )

    this.context.registerProvider(
      'composerStrategy',
      () => new GitMentionComposerStrategyProvider()
    )

    this.context.registerProvider(
      'noPromptStrategy',
      () => new GitMentionNoPromptStrategyProvider()
    )

    this.context.registerProvider(
      'serverUtils',
      () => new GitMentionServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
