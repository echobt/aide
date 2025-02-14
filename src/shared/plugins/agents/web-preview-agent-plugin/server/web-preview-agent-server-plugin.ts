import type { AgentServerPlugin } from '@shared/plugins/agents/_base/server/agent-server-plugin-context'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { WebPreviewAgentServerUtilsProvider } from './web-preview-agent-server-utils-provider'

export class WebPreviewAgentServerPlugin implements AgentServerPlugin {
  id = AgentPluginId.WebPreview

  version = pkg.version

  async activate(context: any) {
    context.registerProvider(
      'serverUtils',
      () => new WebPreviewAgentServerUtilsProvider()
    )
  }
}
