import { createAgentClientPlugin } from '@shared/plugins/agents/_base/client/create-agent-client-plugin'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { DocRetrieverAgentThinkItem } from './doc-retriever-agent-think-item'

export const DocRetrieverAgentClientPlugin = createAgentClientPlugin({
  id: AgentPluginId.DocRetriever,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('CustomRenderThinkItem', () => DocRetrieverAgentThinkItem)
  }
})
