import type { GetAgent } from '@extension/chat/strategies/base'
import type { InlineDiffTask } from '@extension/registers/inline-diff-register/types'
import type { ConversationAction } from '@shared/entities'

import type { EditFileAgent } from './server/edit-file-agent'

export interface EditFileAgentState {
  inlineDiffTask: InlineDiffTask | null
}

export type EditFileAction = ConversationAction<
  EditFileAgentState,
  GetAgent<EditFileAgent>
>
