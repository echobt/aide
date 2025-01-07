import type { AgentServerPlugin } from '@shared/plugins/agents/_base/server/agent-server-plugin-context'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { EditFileAgentServerUtilsProvider } from './edit-file-agent-server-utils-provider'

export class EditFileAgentServerPlugin implements AgentServerPlugin {
  id = AgentPluginId.EditFile

  version = pkg.version

  async activate(context: any) {
    context.registerProvider(
      'serverUtils',
      () => new EditFileAgentServerUtilsProvider()
    )
  }
}
