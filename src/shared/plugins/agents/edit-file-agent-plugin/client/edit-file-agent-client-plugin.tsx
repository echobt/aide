import { CodeEditTaskState } from '@extension/registers/code-edit-register/types'
import { createAgentClientPlugin } from '@shared/plugins/agents/_base/client/create-agent-client-plugin'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import type { IsCompletedAction } from '../../_base/client/agent-client-plugin-types'
import { isSameAction } from '../shared'
import type { EditFileAction } from '../types'
import { EditFileAgentFloatingActionItem } from './edit-file-agent-floating-action-item'
import { EditFileAgentMessageActionItem } from './edit-file-agent-message-action-item'

export const EditFileAgentClientPlugin = createAgentClientPlugin({
  id: AgentPluginId.EditFile,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider(
      'CustomRenderMessageActionItem',
      () => EditFileAgentMessageActionItem
    )

    registerProvider(
      'CustomRenderFloatingActionItem',
      () => EditFileAgentFloatingActionItem
    )

    registerProvider('isSameAction', () => isSameAction)
    registerProvider('isCompletedAction', () => isCompletedAction)
  }
})

const isCompletedAction: IsCompletedAction<EditFileAction> = action =>
  ![CodeEditTaskState.WaitingForReview].includes(
    action.state.codeEditTask?.state as CodeEditTaskState
  )
