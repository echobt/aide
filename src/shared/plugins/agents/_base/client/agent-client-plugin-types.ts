import type { Agent, Conversation } from '@shared/entities'
import type { SFC } from '@shared/types/common'
import type { Updater } from 'use-immer'

export type CustomRenderThinkItemProps<A extends Agent = Agent> = {
  agent: A
}

// for mcp tools (collection of agents by agentType)
export type CustomRenderThinkItemsProps<A extends Agent = Agent> = {
  agents: A[]
}

export type CustomRenderMessageAgentItemProps<A extends Agent = Agent> = {
  agent: A
  setAgent: Updater<A>
  conversation: Conversation
  setConversation: Updater<Conversation>
}

export type CustomRenderFloatingAgentItemProps<A extends Agent = Agent> =
  CustomRenderMessageAgentItemProps<A>

export type IsSameAgent<A extends Agent = Agent> = (
  agentA: A,
  agentB: A
) => boolean

export type IsCompletedAgent<A extends Agent = Agent> = (agent: A) => boolean

export type AgentClientPluginProviderMap = {
  CustomRenderThinkItem: SFC<CustomRenderThinkItemProps>
  CustomRenderMessageAgentItem: SFC<CustomRenderMessageAgentItemProps>
  CustomRenderFloatingAgentItem: SFC<CustomRenderFloatingAgentItemProps>
  isSameAgent: IsSameAgent
  isCompletedAgent: IsCompletedAgent
}
