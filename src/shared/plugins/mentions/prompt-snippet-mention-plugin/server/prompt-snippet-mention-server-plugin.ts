import type {
  MentionServerPlugin,
  MentionServerPluginContext
} from '@shared/plugins/mentions/_base/server/mention-server-plugin-context'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'

import { PromptSnippetMentionServerUtilsProvider } from './prompt-snippet-mention-server-utils-provider'

export class PromptSnippetMentionServerPlugin implements MentionServerPlugin {
  id = MentionPluginId.PromptSnippet

  version: string = pkg.version

  private context: MentionServerPluginContext | null = null

  async activate(context: MentionServerPluginContext): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'serverUtils',
      () => new PromptSnippetMentionServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
