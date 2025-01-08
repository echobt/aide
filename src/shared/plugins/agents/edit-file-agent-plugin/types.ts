import type { GetAgent } from '@extension/chat/strategies/_base'
import type { InlineDiffTaskJson } from '@extension/registers/inline-diff-register/types'
import type { ConversationAction } from '@shared/entities'

import type { EditFileAgent } from './server/edit-file-agent'

export interface EditFileAgentState {
  inlineDiffTask: InlineDiffTaskJson | null
}

export type EditFileAction = ConversationAction<
  EditFileAgentState,
  GetAgent<EditFileAgent>
>
