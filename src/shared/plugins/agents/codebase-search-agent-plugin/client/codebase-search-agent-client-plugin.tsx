import { createAgentClientPlugin } from '@shared/plugins/agents/_base/client/create-agent-client-plugin'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { CodebaseSearchAgentThinkItem } from './codebase-search-agent-think-item'

export const CodebaseSearchAgentClientPlugin = createAgentClientPlugin({
  id: AgentPluginId.CodebaseSearch,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider(
      'CustomRenderThinkItem',
      () => CodebaseSearchAgentThinkItem
    )
  }
})
