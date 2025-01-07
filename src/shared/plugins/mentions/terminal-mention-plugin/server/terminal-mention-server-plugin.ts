import type {
  MentionServerPlugin,
  MentionServerPluginContext
} from '@shared/plugins/mentions/_base/server/mention-server-plugin-context'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'

import { TerminalMentionChatStrategyProvider } from './chat-strategy/terminal-mention-chat-strategy-provider'
import { TerminalMentionServerUtilsProvider } from './terminal-mention-server-utils-provider'

export class TerminalMentionServerPlugin implements MentionServerPlugin {
  id = MentionPluginId.Terminal

  version: string = pkg.version

  private context: MentionServerPluginContext | null = null

  async activate(context: MentionServerPluginContext): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'chatStrategy',
      () => new TerminalMentionChatStrategyProvider()
    )

    this.context.registerProvider(
      'serverUtils',
      () => new TerminalMentionServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
