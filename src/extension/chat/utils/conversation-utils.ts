import type { RegisterManager } from '@extension/registers/register-manager'
import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import type { ChatContext, Conversation } from '@shared/entities'
import type { MentionServerUtilsProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'
import { collectThinkAgentsUntilNextHuman } from '@shared/utils/chat-context-helper/common/chat-context-operator'

/**
 * Process all conversations in chatContext and collect AI agents for each human conversation
 * Returns a new ChatContext with updated conversations
 */
export const processConversationsForCreateMessage = (props: {
  chatContext: ChatContext
  registerManager: RegisterManager
  newConversations?: Conversation[]
}): ChatContext => {
  const { chatContext, newConversations, registerManager } = props
  const conversations = [
    ...chatContext.conversations,
    ...(newConversations || [])
  ]
  const serverPluginRegister = registerManager.getRegister(ServerPluginRegister)
  const serverUtilsProviders =
    serverPluginRegister?.mentionServerPluginRegistry?.providerManagers.serverUtils.getValues()

  if (!serverUtilsProviders) {
    throw new Error('ServerUtilsProviders not found')
  }

  // First pass: process all conversations with providers
  let updatedConversations = conversations
    .filter(currentConversation => !currentConversation.state.isFreeze)
    .map(currentConversation => {
      const updatedConversation = updateConversationByProviders(
        serverUtilsProviders,
        currentConversation
      )
      return updatedConversation
    })

  // Second pass: collect thinkAgents for human conversations
  updatedConversations = updatedConversations.map((conversation, index) => {
    if (conversation.role === 'human') {
      const thinkAgents = collectThinkAgentsUntilNextHuman(
        updatedConversations,
        index
      )
      return {
        ...conversation,
        thinkAgents: [...conversation.thinkAgents, ...thinkAgents]
      }
    }
    return conversation
  })

  return {
    ...chatContext,
    conversations:
      (newConversations?.length || 0) > 1
        ? updatedConversations.slice(-1)
        : updatedConversations
  }
}

const updateConversationByProviders = (
  serverUtilsProviders: MentionServerUtilsProvider[],
  conversation: Conversation
): Conversation => {
  let latestConversation = conversation
  for (const provider of serverUtilsProviders) {
    if (!provider.processConversationBeforeCreateMessage) continue
    latestConversation =
      provider.processConversationBeforeCreateMessage(latestConversation)
  }
  return latestConversation
}
