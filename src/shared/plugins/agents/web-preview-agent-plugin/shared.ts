import type { IsSameAction } from '../_base/client/agent-client-plugin-types'
import type { WebPreviewAction } from './types'

export const isSameAction: IsSameAction<WebPreviewAction> = (
  actionA,
  actionB
) => {
  const projectNameA = actionA.agent?.input.name
  const projectNameB = actionB.agent?.input.name
  return projectNameA === projectNameB
}
