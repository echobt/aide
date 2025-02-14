import { createAgentClientPlugin } from '@shared/plugins/agents/_base/client/create-agent-client-plugin'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import type { IsSameAction } from '../../_base/client/agent-client-plugin-types'
import type { WebPreviewAction } from '../types'

export const WebPreviewAgentClientPlugin = createAgentClientPlugin({
  id: AgentPluginId.WebPreview,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('isSameAction', () => isSameAction)
  }
})

const isSameAction: IsSameAction<WebPreviewAction> = (actionA, actionB) => {
  const projectNameA = actionA.agent?.input.name
  const projectNameB = actionB.agent?.input.name
  return projectNameA === projectNameB
}
