import type { SingleSessionActionParams } from '@extension/actions/agent-actions'
import type { BaseAgent } from '@extension/chat/strategies/_base'
import type { ActionContext } from '@shared/actions/types'
import type { ConversationAction } from '@shared/entities'
import { ProviderManager } from '@shared/plugins/_shared/provider-manager'

import type { AgentPluginId } from '../types'

export interface AgentServerUtilsProvider<
  AgentType extends BaseAgent = BaseAgent,
  ActionType extends ConversationAction = ConversationAction
> {
  getAgentClass: () => new (...args: any[]) => AgentType
  getIsNeedSaveWorkspaceCheckpoint?: () => boolean
  onStartAction?: (
    context: ActionContext<SingleSessionActionParams<ActionType>>
  ) => Promise<void>
  onRestartAction?: (
    context: ActionContext<SingleSessionActionParams<ActionType>>
  ) => Promise<void>
  onRefreshAction?: (
    context: ActionContext<SingleSessionActionParams<ActionType>>
  ) => Promise<void>
  onAcceptAction?: (
    context: ActionContext<SingleSessionActionParams<ActionType>>
  ) => Promise<void>
  onRejectAction?: (
    context: ActionContext<SingleSessionActionParams<ActionType>>
  ) => Promise<void>
}

export const createAgentProviderManagers = () =>
  ({
    serverUtils: new ProviderManager<AgentPluginId, AgentServerUtilsProvider>()
  }) as const satisfies Record<string, ProviderManager<AgentPluginId, any>>
