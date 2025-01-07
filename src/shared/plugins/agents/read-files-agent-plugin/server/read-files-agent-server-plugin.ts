import type {
  AgentServerPlugin,
  AgentServerPluginContext
} from '@shared/plugins/agents/_base/server/agent-server-plugin-context'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { ReadFilesAgentServerUtilsProvider } from './read-files-agent-server-utils-provider'

export class ReadFilesAgentServerPlugin implements AgentServerPlugin {
  id = AgentPluginId.ReadFiles

  version: string = pkg.version

  private context: AgentServerPluginContext | null = null

  async activate(context: AgentServerPluginContext): Promise<void> {
    this.context = context

    this.context.registerProvider(
      'serverUtils',
      () => new ReadFilesAgentServerUtilsProvider()
    )
  }

  deactivate(): void {
    this.context = null
  }
}
