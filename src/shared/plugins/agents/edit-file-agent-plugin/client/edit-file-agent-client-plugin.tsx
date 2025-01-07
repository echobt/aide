import { InlineDiffTaskState } from '@extension/registers/inline-diff-register/types'
import { createAgentClientPlugin } from '@shared/plugins/agents/_base/client/create-agent-client-plugin'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { pkg } from '@shared/utils/pkg'

import type {
  IsCompletedAction,
  IsSameAction
} from '../../_base/client/agent-client-plugin-types'
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

const isSameAction: IsSameAction<EditFileAction> = (actionA, actionB) => {
  const filePathA = actionA.agent?.input.targetFilePath
  const filePathB = actionB.agent?.input.targetFilePath
  return filePathA === filePathB
}

const isCompletedAction: IsCompletedAction<EditFileAction> = action =>
  ![InlineDiffTaskState.Reviewing].includes(
    action.state.inlineDiffTask?.state as InlineDiffTaskState
  )
