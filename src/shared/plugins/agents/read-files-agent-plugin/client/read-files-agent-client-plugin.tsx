import { createAgentClientPlugin } from '@shared/plugins/agents/_base/client/create-agent-client-plugin'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { ReadFilesAgentThinkItem } from './read-files-agent-think-item'

export const ReadFilesAgentClientPlugin = createAgentClientPlugin({
  id: AgentPluginId.ReadFiles,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('CustomRenderThinkItem', () => ReadFilesAgentThinkItem)
  }
})
