import { createAgentClientPlugin } from '@shared/plugins/agents/_base/client/create-agent-client-plugin'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { WebVisitAgentThinkItem } from './web-visit-agent-think-item'

export const WebVisitAgentClientPlugin = createAgentClientPlugin({
  id: AgentPluginId.WebVisit,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('CustomRenderThinkItem', () => WebVisitAgentThinkItem)
  }
})
