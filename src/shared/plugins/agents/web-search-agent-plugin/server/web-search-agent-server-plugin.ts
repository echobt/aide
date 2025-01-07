import type {
  AgentServerPlugin,
  AgentServerPluginContext
} from '@shared/plugins/agents/_base/server/agent-server-plugin-context'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { WebSearchAgentServerUtilsProvider } from './web-search-agent-server-utils-provider'

export class WebSearchAgentServerPlugin implements AgentServerPlugin {
  id = AgentPluginId.WebSearch

  version: string = pkg.version

  private context: AgentServerPluginContext | null = null

  async activate(context: AgentServerPluginContext): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'serverUtils',
      () => new WebSearchAgentServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
