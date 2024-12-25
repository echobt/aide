import type { ActionRegister } from '@extension/registers/action-register'
import type { StructuredTool } from '@langchain/core/tools'
import type { ChatContext, Conversation, Mention } from '@shared/entities'
import type {
  BaseStrategyOptions,
  ChatGraphNode,
  ChatGraphState
} from '@shared/plugins/base/strategies'

import { ProviderManager } from '../provider-manager'

export interface ChatStrategyProvider {
  buildSystemMessagePrompt?: (chatContext: ChatContext) => Promise<string>
  buildContextMessagePrompt?: (
    conversation: Conversation,
    chatContext: ChatContext
  ) => Promise<string>
  buildHumanMessagePrompt?: (
    conversation: Conversation,
    chatContext: ChatContext
  ) => Promise<string>
  buildHumanMessageEndPrompt?: (
    conversation: Conversation,
    chatContext: ChatContext
  ) => Promise<string>
  buildHumanMessageImageUrls?: (
    conversation: Conversation,
    chatContext: ChatContext
  ) => Promise<string[]>
  buildAgentTools?: (
    strategyOptions: BaseStrategyOptions,
    graphState: ChatGraphState
  ) => Promise<StructuredTool[]>
  buildLanggraphToolNodes?: (
    strategyOptions: BaseStrategyOptions
  ) => Promise<ChatGraphNode[]>
}

export type RefreshMentionFn = (mention: Mention) => Mention

export interface ServerUtilsProvider {
  createRefreshMentionFn: (
    actionRegister: ActionRegister
  ) => Promise<RefreshMentionFn>
  processConversationBeforeCreateMessage?: (
    conversation: Conversation
  ) => Conversation
}

export const createProviderManagers = () =>
  ({
    chatStrategy: new ProviderManager<ChatStrategyProvider>(),
    serverUtils: new ProviderManager<ServerUtilsProvider>()
  }) as const satisfies Record<string, ProviderManager<any>>
