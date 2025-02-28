import type { SingleSessionAgentParams } from '@extension/actions/agent-actions'
import type { BaseAgent, GetAgent } from '@extension/chat/strategies/_base'
import type { ActionContext } from '@shared/actions/types'
import { ProviderManager } from '@shared/plugins/_shared/provider-manager'

import type { IsSameAgent } from '../client/agent-client-plugin-types'
import type { AgentPluginId } from '../types'

export interface AgentServerUtilsProvider<A extends BaseAgent = BaseAgent> {
  getAgentClass: () => new (...args: any[]) => A
  getIsNeedSaveWorkspaceCheckpoint?: () => boolean
  isSameAgent?: IsSameAgent<GetAgent<A>>
  onStartAgent?: (
    context: ActionContext<SingleSessionAgentParams>
  ) => Promise<void>
  onRestartAgent?: (
    context: ActionContext<SingleSessionAgentParams>
  ) => Promise<void>
  onRefreshAgent?: (
    context: ActionContext<SingleSessionAgentParams>
  ) => Promise<void>
  onAcceptAgent?: (
    context: ActionContext<SingleSessionAgentParams>
  ) => Promise<void>
  onRejectAgent?: (
    context: ActionContext<SingleSessionAgentParams>
  ) => Promise<void>
}

export const createAgentProviderManagers = () =>
  ({
    serverUtils: new ProviderManager<AgentPluginId, AgentServerUtilsProvider>()
  }) as const satisfies Record<string, ProviderManager<AgentPluginId, any>>
