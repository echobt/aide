import type {
  AgentServerPlugin,
  AgentServerPluginContext
} from '@shared/plugins/agents/_base/server/agent-server-plugin-context'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { DocRetrieverAgentServerUtilsProvider } from './doc-retriever-agent-server-utils-provider'

export class DocRetrieverAgentServerPlugin implements AgentServerPlugin {
  id = AgentPluginId.DocRetriever

  version: string = pkg.version

  private context: AgentServerPluginContext | null = null

  async activate(context: AgentServerPluginContext): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'serverUtils',
      () => new DocRetrieverAgentServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
