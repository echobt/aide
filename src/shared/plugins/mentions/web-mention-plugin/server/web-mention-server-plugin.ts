import type {
  MentionServerPlugin,
  MentionServerPluginContext
} from '@shared/plugins/mentions/_base/server/mention-server-plugin-context'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'

import { WebMentionChatStrategyProvider } from './chat-strategy/web-mention-chat-strategy-provider'
import { WebMentionComposerStrategyProvider } from './composer-strategy/web-mention-composer-strategy-provider'
import { WebMentionNoPromptStrategyProvider } from './no-prompt-strategy/web-mention-no-prompt-strategy-provider'
import { WebMentionServerUtilsProvider } from './web-mention-server-utils-provider'

export class WebMentionServerPlugin implements MentionServerPlugin {
  id = MentionPluginId.Web

  version: string = pkg.version

  private context: MentionServerPluginContext | null = null

  async activate(context: MentionServerPluginContext): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'chatStrategy',
      () => new WebMentionChatStrategyProvider()
    )

    this.context.registerProvider(
      'composerStrategy',
      () => new WebMentionComposerStrategyProvider()
    )

    this.context.registerProvider(
      'noPromptStrategy',
      () => new WebMentionNoPromptStrategyProvider()
    )

    this.context.registerProvider(
      'serverUtils',
      () => new WebMentionServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
