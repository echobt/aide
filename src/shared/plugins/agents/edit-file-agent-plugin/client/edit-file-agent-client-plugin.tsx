import { CodeEditTaskState } from '@extension/registers/code-edit-register/types'
import { createAgentClientPlugin } from '@shared/plugins/agents/_base/client/create-agent-client-plugin'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'
import type { GetAgent } from '@webview/types/chat'

import type { IsCompletedAgent } from '../../_base/client/agent-client-plugin-types'
import type { EditFileAgent } from '../server/edit-file-agent'
import { isSameAgent } from '../shared'
import { EditFileAgentFloatingItem } from './edit-file-agent-floating-item'
import { EditFileAgentMessageItem } from './edit-file-agent-message-item'

export const EditFileAgentClientPlugin = createAgentClientPlugin({
  id: AgentPluginId.EditFile,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider(
      'CustomRenderMessageAgentItem',
      () => EditFileAgentMessageItem
    )

    registerProvider(
      'CustomRenderFloatingAgentItem',
      () => EditFileAgentFloatingItem
    )

    registerProvider('isSameAgent', () => isSameAgent)
    registerProvider('isCompletedAgent', () => isCompletedAgent)
  }
})

const isCompletedAgent: IsCompletedAgent<GetAgent<EditFileAgent>> = agent =>
  ![CodeEditTaskState.WaitingForReview].includes(
    agent.output.codeEditTask?.state as CodeEditTaskState
  )
