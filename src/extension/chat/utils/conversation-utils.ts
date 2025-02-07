import type { RegisterManager } from '@extension/registers/register-manager'
import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import type { ChatContext, Conversation } from '@shared/entities'
import type { MentionServerUtilsProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

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
    serverPluginRegister?.mentionServerPluginRegistry?.providerManagers.serverUtils.getValues()

  if (!serverUtilsProviders) {
    throw new Error('ServerUtilsProviders not found')
  }

  const updatedConversations = conversations
    .filter(currentConversation => !currentConversation.state.isFreeze)
    .map(currentConversation => {
      const updatedConversation = updateConversationByProviders(
        serverUtilsProviders,
        currentConversation
      )
      return updatedConversation
    })

  return {
    ...chatContext,
    conversations: updatedConversations
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
