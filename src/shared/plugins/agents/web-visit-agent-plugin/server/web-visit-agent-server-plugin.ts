import type {
  AgentServerPlugin,
  AgentServerPluginContext
} from '@shared/plugins/agents/_base/server/agent-server-plugin-context'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { WebVisitAgentServerUtilsProvider } from './web-visit-agent-server-utils-provider'

export class WebVisitAgentServerPlugin implements AgentServerPlugin {
  id = AgentPluginId.WebVisit

  version: string = pkg.version

  private context: AgentServerPluginContext | null = null

  async activate(context: AgentServerPluginContext): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'serverUtils',
      () => new WebVisitAgentServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
