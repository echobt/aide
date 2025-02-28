import { processConversationsForCreateMessage } from '@extension/chat/utils/conversation-utils'
import type { CommandManager } from '@extension/commands/command-manager'
import { getRulesForAiConfigFromUserFiles } from '@extension/file-utils/user-custom-config-file'
import { globalSettingsDB } from '@extension/lowdb/settings-db'
import type { RegisterManager } from '@extension/registers/register-manager'
import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type {
  ChatContext,
  Conversation,
  LangchainMessage
} from '@shared/entities'
import { settledPromiseResults } from '@shared/utils/common'
import { t } from 'i18next'

import type {
  BaseStrategyOptions,
  BuildPromptMode
} from '../../_base/base-strategy'
import { ConversationMessageConstructor } from './conversation-message-constructor'

interface ComposerMessagesConstructorOptions extends BaseStrategyOptions {
  chatContext: ChatContext
  newConversations?: Conversation[]
  mode?: BuildPromptMode
}

export class ComposerMessagesConstructor {
  private chatContext: ChatContext

  private registerManager: RegisterManager

  private commandManager: CommandManager

  private mode: BuildPromptMode

  private getComposerStrategyProvider() {
    return this.registerManager
      .getRegister(ServerPluginRegister)
      ?.mentionServerPluginRegistry?.providerManagers.composerStrategy.mergeAll()
  }

  constructor(options: ComposerMessagesConstructorOptions) {
    this.chatContext = processConversationsForCreateMessage({
      chatContext: options.chatContext,
      registerManager: options.registerManager,
      newConversations: options.newConversations
    })
    this.registerManager = options.registerManager
    this.commandManager = options.commandManager
    this.mode = options.mode || 'normal'
  }

  async constructMessages(): Promise<LangchainMessage[]> {
    const systemMessage = await this.createSystemMessage()
    const instructionMessage = await this.createCustomInstructionMessage()
    const conversationMessages = await this.buildConversationMessages()

    return [systemMessage, instructionMessage, ...conversationMessages].filter(
      Boolean
    ) as LangchainMessage[]
  }

  private async createSystemMessage(): Promise<SystemMessage | null> {
    const composerStrategyProvider = this.getComposerStrategyProvider()
    const content = await composerStrategyProvider?.buildSystemMessagePrompt?.(
      this.mode,
      this.chatContext
    )

    return content ? new SystemMessage({ content }) : null
  }

  private async createCustomInstructionMessage(): Promise<HumanMessage | null> {
    const rulesForAI = await globalSettingsDB.getSetting('rulesForAI')
    const rulesForAIFromUserFiles = await getRulesForAiConfigFromUserFiles()
    const finalRulesForAI = [rulesForAI, rulesForAIFromUserFiles]
      .filter(Boolean)
      .join('\n')

    if (!finalRulesForAI) return null

    return new HumanMessage({
      content: `
Please also follow these instructions in all of your responses if relevant to my query. No need to acknowledge these instructions directly in your response.
<custom_instructions>
${finalRulesForAI}
</custom_instructions>
      `
    })
  }

  private async buildConversationMessages(): Promise<LangchainMessage[]> {
    const composerStrategyProvider = this.getComposerStrategyProvider()

    if (!composerStrategyProvider)
      throw new Error(t('extension.chat.composerStrategy.providerNotFound'))

    const messagePromises = this.chatContext.conversations.map(conversation =>
      new ConversationMessageConstructor({
        mode: this.mode,
        chatContext: this.chatContext,
        conversation,
        composerStrategyProvider
      }).buildMessages()
    )
    const messageArrays = await settledPromiseResults(messagePromises)
    return messageArrays.flat()
  }
}
