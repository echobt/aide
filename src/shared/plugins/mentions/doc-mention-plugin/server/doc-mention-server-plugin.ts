import type {
  MentionServerPlugin,
  MentionServerPluginContext
} from '@shared/plugins/mentions/_base/server/mention-server-plugin-context'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'

import { DocMentionChatStrategyProvider } from './chat-strategy/doc-mention-chat-strategy-provider'
import { DocMentionComposerStrategyProvider } from './composer-strategy/doc-mention-composer-strategy-provider'
import { DocMentionServerUtilsProvider } from './doc-mention-server-utils-provider'
import { DocMentionNoPromptStrategyProvider } from './no-prompt-strategy/doc-mention-no-prompt-strategy-provider'

export class DocMentionServerPlugin implements MentionServerPlugin {
  id = MentionPluginId.Doc

  version: string = pkg.version

  private context: MentionServerPluginContext | null = null

  async activate(context: MentionServerPluginContext): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'chatStrategy',
      () => new DocMentionChatStrategyProvider()
    )

    this.context.registerProvider(
      'composerStrategy',
      () => new DocMentionComposerStrategyProvider()
    )

    this.context.registerProvider(
      'noPromptStrategy',
      () => new DocMentionNoPromptStrategyProvider()
    )

    this.context.registerProvider(
      'serverUtils',
      () => new DocMentionServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
