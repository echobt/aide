import type { ActionRegister } from '@extension/registers/action-register'
import type { StructuredTool } from '@langchain/core/tools'
import type { ChatContext, Conversation, Mention } from '@shared/entities'
import { ProviderManager } from '@shared/plugins/_shared/provider-manager'
import type {
  BaseStrategyOptions,
  BuildPromptMode,
  ChatGraphNode,
  ChatGraphState
} from '@shared/plugins/_shared/strategies'

import type { MentionPluginId } from '../types'

export interface MentionChatStrategyProvider {
  buildSystemMessagePrompt?: (
    mode: BuildPromptMode,
    chatContext: ChatContext
  ) => Promise<string>
  buildContextMessagePrompt?: (
    mode: BuildPromptMode,
    conversation: Conversation,
    chatContext: ChatContext
  ) => Promise<string>
  buildHumanMessagePrompt?: (
    mode: BuildPromptMode,
    conversation: Conversation,
    chatContext: ChatContext
  ) => Promise<string>
  buildHumanMessageEndPrompt?: (
    mode: BuildPromptMode,
    conversation: Conversation,
    chatContext: ChatContext
  ) => Promise<string>
  buildHumanMessageImageUrls?: (
    mode: BuildPromptMode,
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

export interface MentionComposerStrategyProvider
  extends MentionChatStrategyProvider {}

export interface MentionNoPromptStrategyProvider
  extends MentionChatStrategyProvider {}

export type RefreshMentionFn = (mention: Mention) => Mention

export interface MentionServerUtilsProvider {
  createRefreshMentionFn: (
    actionRegister: ActionRegister
  ) => Promise<RefreshMentionFn>
  processConversationBeforeCreateMessage?: (
    conversation: Conversation
  ) => Conversation
}

export const createMentionProviderManagers = () =>
  ({
    chatStrategy: new ProviderManager<
      MentionPluginId,
      MentionChatStrategyProvider
    >(),
    composerStrategy: new ProviderManager<
      MentionPluginId,
      MentionComposerStrategyProvider
    >(),
    serverUtils: new ProviderManager<
      MentionPluginId,
      MentionServerUtilsProvider
    >(),
    noPromptStrategy: new ProviderManager<
      MentionPluginId,
      MentionNoPromptStrategyProvider
    >()
  }) as const satisfies Record<string, ProviderManager<MentionPluginId, any>>
