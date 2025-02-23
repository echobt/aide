import type { Agent, Conversation, ConversationAction } from '@shared/entities'
import type { SFC } from '@shared/types/common'
import type { Updater } from 'use-immer'

export type CustomRenderThinkItemProps<AgentType extends Agent = Agent> = {
  agent: AgentType
}

// for mcp tools (collection of agents by agentType)
export type CustomRenderThinkItemsProps<AgentType extends Agent = Agent> = {
  agents: AgentType[]
}

export type CustomRenderMessageActionItemProps<
  ActionType extends ConversationAction = ConversationAction<any, Agent>
> = {
  conversationAction: ActionType
  setConversationAction: Updater<ActionType>
  conversation: Conversation
  setConversation: Updater<Conversation>
}

export type CustomRenderFloatingActionItemProps<
  ActionType extends ConversationAction = ConversationAction<any, Agent>
> = CustomRenderMessageActionItemProps<ActionType>

export type IsSameAction<
  ActionType extends ConversationAction = ConversationAction<any, Agent>
> = (actionA: ActionType, actionB: ActionType) => boolean

export type IsCompletedAction<
  ActionType extends ConversationAction = ConversationAction<any, Agent>
> = (action: ActionType) => boolean

export type AgentClientPluginProviderMap = {
  CustomRenderThinkItem: SFC<CustomRenderThinkItemProps>
  CustomRenderMessageActionItem: SFC<CustomRenderMessageActionItemProps>
  CustomRenderFloatingActionItem: SFC<CustomRenderFloatingActionItemProps>
  isSameAction: IsSameAction
  isCompletedAction: IsCompletedAction
}
