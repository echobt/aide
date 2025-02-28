import type { GetAgent } from '@extension/chat/strategies/_base'

import type { IsSameAgent } from '../_base/client/agent-client-plugin-types'
import type { EditFileAgent } from './server/edit-file-agent'

export const isSameAgent: IsSameAgent<GetAgent<EditFileAgent>> = (
  agentA,
  agentB
) => {
  const filePathA = agentA.input.targetFilePath
  const filePathB = agentB.input.targetFilePath
  return filePathA === filePathB
}
