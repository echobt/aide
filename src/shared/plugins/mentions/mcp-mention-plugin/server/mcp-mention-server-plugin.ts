import type {
  MentionServerPlugin,
  MentionServerPluginContext
} from '@shared/plugins/mentions/_base/server/mention-server-plugin-context'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'

import { McpMentionChatStrategyProvider } from './chat-strategy/mcp-mention-chat-strategy-provider'
import { McpMentionComposerStrategyProvider } from './composer-strategy/mcp-mention-composer-strategy-provider'
import { McpMentionServerUtilsProvider } from './mcp-mention-server-utils-provider'

export class McpMentionServerPlugin implements MentionServerPlugin {
  id = MentionPluginId.Mcp

  version: string = pkg.version

  private context: MentionServerPluginContext | null = null

  async activate(context: MentionServerPluginContext): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'chatStrategy',
      () => new McpMentionChatStrategyProvider()
    )

    this.context.registerProvider(
      'composerStrategy',
      () => new McpMentionComposerStrategyProvider()
    )

    this.context.registerProvider(
      'serverUtils',
      () => new McpMentionServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
