import type { SingleSessionActionParams } from '@extension/actions/agent-actions'
import type { BaseAgent, GetAgent } from '@extension/chat/strategies/_base'
import type { ActionContext } from '@shared/actions/types'
import type { ConversationAction } from '@shared/entities'
import { ProviderManager } from '@shared/plugins/_shared/provider-manager'

import type { IsSameAction } from '../client/agent-client-plugin-types'
import type { AgentPluginId } from '../types'

export interface AgentServerUtilsProvider<
  AgentType extends BaseAgent = BaseAgent
> {
  getAgentClass: () => new (...args: any[]) => AgentType
  getIsNeedSaveWorkspaceCheckpoint?: () => boolean
  isSameAction?: IsSameAction<ConversationAction<any, GetAgent<AgentType>>>
  onStartAction?: (
    context: ActionContext<SingleSessionActionParams>
  ) => Promise<void>
  onRestartAction?: (
    context: ActionContext<SingleSessionActionParams>
  ) => Promise<void>
  onRefreshAction?: (
    context: ActionContext<SingleSessionActionParams>
  ) => Promise<void>
  onAcceptAction?: (
    context: ActionContext<SingleSessionActionParams>
  ) => Promise<void>
  onRejectAction?: (
    context: ActionContext<SingleSessionActionParams>
  ) => Promise<void>
}

export const createAgentProviderManagers = () =>
  ({
    serverUtils: new ProviderManager<AgentPluginId, AgentServerUtilsProvider>()
  }) as const satisfies Record<string, ProviderManager<AgentPluginId, any>>
