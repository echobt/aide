import type {
  MentionServerPlugin,
  MentionServerPluginContext
} from '@shared/plugins/mentions/_base/server/mention-server-plugin-context'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'

import { FsMentionChatStrategyProvider } from './chat-strategy/fs-mention-chat-strategy-provider'
import { FsMentionComposerStrategyProvider } from './composer-strategy/fs-mention-composer-strategy-provider'
import { FsMentionServerUtilsProvider } from './fs-mention-server-utils-provider'
import { FsMentionNoPromptStrategyProvider } from './no-prompt-strategy/fs-mention-no-prompt-strategy-provider'

export class FsMentionServerPlugin implements MentionServerPlugin {
  id = MentionPluginId.Fs

  version: string = pkg.version

  private context: MentionServerPluginContext | null = null

  async activate(context: MentionServerPluginContext): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'chatStrategy',
      () => new FsMentionChatStrategyProvider()
    )

    this.context.registerProvider(
      'composerStrategy',
      () => new FsMentionComposerStrategyProvider()
    )

    this.context.registerProvider(
      'noPromptStrategy',
      () => new FsMentionNoPromptStrategyProvider()
    )

    this.context.registerProvider(
      'serverUtils',
      () => new FsMentionServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
