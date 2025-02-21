import type { IsSameAction } from '../_base/client/agent-client-plugin-types'
import type { EditFileAction } from './types'

export const isSameAction: IsSameAction<EditFileAction> = (
  actionA,
  actionB
) => {
  const filePathA = actionA.agent?.input.targetFilePath
  const filePathB = actionB.agent?.input.targetFilePath
  return filePathA === filePathB
}
