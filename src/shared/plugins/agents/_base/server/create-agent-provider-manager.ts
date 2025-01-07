import type { BaseAgent } from '@extension/chat/strategies/base'
import type { ActionContext } from '@shared/actions/types'
import type {
  ChatContext,
  Conversation,
  ConversationAction
} from '@shared/entities'
import { ProviderManager } from '@shared/plugins/_shared/provider-manager'

import type { AgentPluginId } from '../types'

export interface AgentServerUtilsProvider<
  AgentType extends BaseAgent = BaseAgent,
  ActionType extends ConversationAction = ConversationAction
> {
  getAgentClass: () => new (...args: any[]) => AgentType
  onStartAction?: (
    context: ActionContext<{
      chatContext: ChatContext
      conversation: Conversation
      action: ActionType
    }>
  ) => Promise<void>
  onRestartAction?: (
    context: ActionContext<{
      chatContext: ChatContext
      conversation: Conversation
      action: ActionType
    }>
  ) => Promise<void>
  onAcceptAction?: (
    context: ActionContext<{
      chatContext: ChatContext
      conversation: Conversation
      action: ActionType
    }>
  ) => Promise<void>
  onRejectAction?: (
    context: ActionContext<{
      chatContext: ChatContext
      conversation: Conversation
      action: ActionType
    }>
  ) => Promise<void>
}

export const createAgentProviderManagers = () =>
  ({
    serverUtils: new ProviderManager<AgentPluginId, AgentServerUtilsProvider>()
  }) as const satisfies Record<string, ProviderManager<AgentPluginId, any>>
