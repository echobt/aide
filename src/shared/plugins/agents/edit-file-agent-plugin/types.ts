import type { GetAgent } from '@extension/chat/strategies/_base'
import type { CodeEditTaskJson } from '@extension/registers/code-edit-register/types'
import type { ConversationAction } from '@shared/entities'

import type { EditFileAgent } from './server/edit-file-agent'

export interface EditFileAgentState {
  codeEditTask: CodeEditTaskJson | null
}

export type EditFileAction = ConversationAction<
  EditFileAgentState,
  GetAgent<EditFileAgent>
>
