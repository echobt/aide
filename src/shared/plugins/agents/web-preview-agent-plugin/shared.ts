import type { GetAgent } from '@webview/types/chat'

import type { IsSameAgent } from '../_base/client/agent-client-plugin-types'
import type { WebPreviewAgent } from './server/web-preview-agent'

export const isSameAgent: IsSameAgent<GetAgent<WebPreviewAgent>> = (
  agentA,
  agentB
) => {
  const projectNameA = agentA.input.name
  const projectNameB = agentB.input.name
  return projectNameA === projectNameB
}
