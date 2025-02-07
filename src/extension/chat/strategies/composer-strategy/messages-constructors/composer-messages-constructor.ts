import { processConversationsForCreateMessage } from '@extension/chat/utils/conversation-utils'
import type { CommandManager } from '@extension/commands/command-manager'
import type { RegisterManager } from '@extension/registers/register-manager'
import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { ChatContext, LangchainMessage } from '@shared/entities'
import { settledPromiseResults } from '@shared/utils/common'

import type { BaseStrategyOptions } from '../../_base/base-strategy'
import { ConversationMessageConstructor } from './conversation-message-constructor'

interface ComposerMessagesConstructorOptions extends BaseStrategyOptions {
  chatContext: ChatContext
}

export class ComposerMessagesConstructor {
  private chatContext: ChatContext

  private registerManager: RegisterManager

  private commandManager: CommandManager

  private getComposerStrategyProvider() {
    return this.registerManager
      .getRegister(ServerPluginRegister)
      ?.mentionServerPluginRegistry?.providerManagers.composerStrategy.mergeAll()
  }

  constructor(options: ComposerMessagesConstructorOptions) {
    this.chatContext = processConversationsForCreateMessage(
      options.chatContext,
      options.registerManager
    )
    this.registerManager = options.registerManager
    this.commandManager = options.commandManager
  }

  async constructMessages(): Promise<LangchainMessage[]> {
    const systemMessage = await this.createSystemMessage()
    const instructionMessage = this.createCustomInstructionMessage()
    const conversationMessages = await this.buildConversationMessages()

    return [systemMessage, instructionMessage, ...conversationMessages].filter(
      Boolean
    ) as LangchainMessage[]
  }

  private async createSystemMessage(): Promise<SystemMessage | null> {
    const composerStrategyProvider = this.getComposerStrategyProvider()
    const content = await composerStrategyProvider?.buildSystemMessagePrompt?.(
      this.chatContext
    )

    return content ? new SystemMessage({ content }) : null
  }

  private createCustomInstructionMessage(): HumanMessage | null {
    const { explicitContext } = this.chatContext.settings
    if (!explicitContext) return null

    return new HumanMessage({
      content: `
Please also follow these instructions in all of your responses if relevant to my query. No need to acknowledge these instructions directly in your response.
<custom_instructions>
${explicitContext}
</custom_instructions>
      `
    })
  }

  private async buildConversationMessages(): Promise<LangchainMessage[]> {
    const composerStrategyProvider = this.getComposerStrategyProvider()

    if (!composerStrategyProvider)
      throw new Error('Composer strategy provider not found')

    const messagePromises = this.chatContext.conversations.map(conversation =>
      new ConversationMessageConstructor({
        chatContext: this.chatContext,
        conversation,
        composerStrategyProvider
      }).buildMessages()
    )
    const messageArrays = await settledPromiseResults(messagePromises)
    return messageArrays.flat()
  }
}
