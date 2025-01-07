import { createAgentClientPlugin } from '@shared/plugins/agents/_base/client/create-agent-client-plugin'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { WebSearchAgentThinkItem } from './web-search-agent-think-item'

export const WebSearchAgentClientPlugin = createAgentClientPlugin({
  id: AgentPluginId.WebSearch,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('CustomRenderThinkItem', () => WebSearchAgentThinkItem)
  }
})
