import { createAgentClientPlugin } from '@shared/plugins/agents/_base/client/create-agent-client-plugin'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import { isSameAction } from '../shared'

export const WebPreviewAgentClientPlugin = createAgentClientPlugin({
  id: AgentPluginId.WebPreview,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('isSameAction', () => isSameAction)
  }
})
