import { processConversationsForCreateMessage } from '@extension/chat/utils/conversation-utils'
import type { CommandManager } from '@extension/commands/command-manager'
import type { RegisterManager } from '@extension/registers/register-manager'
import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { SystemMessage } from '@langchain/core/messages'
import type {
  ChatContext,
  Conversation,
  LangchainMessage
} from '@shared/entities'
import { settledPromiseResults } from '@shared/utils/common'
import { t } from 'i18next'

import type { BaseStrategyOptions } from '../../_base/base-strategy'
import { ConversationMessageConstructor } from './conversation-message-constructor'

interface NoPromptMessagesConstructorOptions extends BaseStrategyOptions {
  chatContext: ChatContext
  newConversations?: Conversation[]
}

export class NoPromptMessagesConstructor {
  private chatContext: ChatContext

  private registerManager: RegisterManager

  private commandManager: CommandManager

  private getNoPromptStrategyProvider() {
    return this.registerManager
      .getRegister(ServerPluginRegister)
      ?.mentionServerPluginRegistry?.providerManagers.noPromptStrategy.mergeAll()
  }

  constructor(options: NoPromptMessagesConstructorOptions) {
    this.chatContext = processConversationsForCreateMessage({
      chatContext: options.chatContext,
      registerManager: options.registerManager,
      newConversations: options.newConversations
    })
    this.registerManager = options.registerManager
    this.commandManager = options.commandManager
  }

  async constructMessages(): Promise<LangchainMessage[]> {
    const systemMessage = await this.createSystemMessage()
    const conversationMessages = await this.buildConversationMessages()

    return [systemMessage, ...conversationMessages].filter(
      Boolean
    ) as LangchainMessage[]
  }

  private async createSystemMessage(): Promise<SystemMessage | null> {
    const noPromptStrategyProvider = this.getNoPromptStrategyProvider()
    const content = await noPromptStrategyProvider?.buildSystemMessagePrompt?.(
      this.chatContext
    )

    return content ? new SystemMessage({ content }) : null
  }

  private async buildConversationMessages(): Promise<LangchainMessage[]> {
    const noPromptStrategyProvider = this.getNoPromptStrategyProvider()

    if (!noPromptStrategyProvider)
      throw new Error(t('extension.chat.noPromptStrategy.providerNotFound'))

    const messagePromises = this.chatContext.conversations.map(conversation =>
      new ConversationMessageConstructor({
        chatContext: this.chatContext,
        conversation,
        noPromptStrategyProvider
      }).buildMessages()
    )
    const messageArrays = await settledPromiseResults(messagePromises)
    return messageArrays.flat()
  }
}
