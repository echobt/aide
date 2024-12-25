import type {
  ServerPlugin,
  ServerPluginContext
} from '@shared/plugins/base/server/server-plugin-context'
import { PluginId } from '@shared/plugins/base/types'
import { pkg } from '@shared/utils/pkg'

import type { PromptSnippetPluginState } from '../types'
import { PromptSnippetServerUtilsProvider } from './prompt-snippet-server-utils-provider'

export class PromptSnippetServerPlugin
  implements ServerPlugin<PromptSnippetPluginState>
{
  id = PluginId.PromptSnippet

  version: string = pkg.version

  private context: ServerPluginContext<PromptSnippetPluginState> | null = null

  async activate(
    context: ServerPluginContext<PromptSnippetPluginState>
  ): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'serverUtils',
      () => new PromptSnippetServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
