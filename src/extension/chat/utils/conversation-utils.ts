import type { RegisterManager } from '@extension/registers/register-manager'
import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import type { Agent, ChatContext, Conversation } from '@shared/entities'
import type { ServerUtilsProvider } from '@shared/plugins/base/server/create-provider-manager'

/**
 * Process all conversations in chatContext and collect AI agents for each human conversation
 * Returns a new ChatContext with updated conversations
 */
export const processConversationsForCreateMessage = (
  chatContext: ChatContext,
  registerManager: RegisterManager
): ChatContext => {
  const { conversations } = chatContext
  const serverPluginRegister = registerManager.getRegister(ServerPluginRegister)
  const serverUtilsProviders =
    serverPluginRegister?.serverPluginRegistry?.providerManagers.serverUtils.getValues()

  if (!serverUtilsProviders) {
    throw new Error('ServerUtilsProviders not found')
  }

  const updatedConversations = conversations.map(
    (currentConversation, index) => {
      const updatedAgentsConversations = updateConversationAgents(
        chatContext,
        currentConversation,
        index
      )
      const updatedConversation = updateConversationByProviders(
        serverUtilsProviders,
        updatedAgentsConversations
      )
      return updatedConversation
    }
  )

  return {
    ...chatContext,
    conversations: updatedConversations
  }
}

const updateConversationAgents = (
  chatContext: ChatContext,
  currentConversation: Conversation,
  index: number
): Conversation => {
  const { conversations } = chatContext
  if (currentConversation.role !== 'human') return currentConversation

  // Collect AI agents until next human message
  const aiAgents: Agent[] = []
  let i = index + 1

  while (i < conversations.length && conversations[i]!.role !== 'human') {
    if (conversations[i]!.role === 'ai') {
      aiAgents.push(...(conversations[i]!.agents || []))
    }
    i++
  }

  return {
    ...currentConversation,
    agents: aiAgents
  }
}

const updateConversationByProviders = (
  serverUtilsProviders: ServerUtilsProvider[],
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
