import { processConversationsForCreateMessage } from '@extension/chat/utils/conversation-utils'
import type { CommandManager } from '@extension/commands/command-manager'
import type { RegisterManager } from '@extension/registers/register-manager'
import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { WebVMRegister } from '@extension/registers/webvm-register'
import { defaultPresetName } from '@extension/registers/webvm-register/presets/_base/constants'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type {
  ChatContext,
  Conversation,
  LangchainMessage,
  WebPreviewProject
} from '@shared/entities'
import { getDefaultWebPreviewProject } from '@shared/utils/chat-context-helper/common/web-preview-project'
import { settledPromiseResults } from '@shared/utils/common'

import type { BaseStrategyOptions } from '../../_base/base-strategy'
import { ConversationMessageConstructor } from '../../chat-strategy/messages-constructors/conversation-message-constructor'
import { v1SystemPrompt } from './system-prompt'

interface V1MessagesConstructorOptions extends BaseStrategyOptions {
  chatContext: ChatContext
  newConversations?: Conversation[]
}

export class V1MessagesConstructor {
  private chatContext: ChatContext

  private registerManager: RegisterManager

  private commandManager: CommandManager

  private presetName: string

  private currentWebPreviewProject: WebPreviewProject | undefined

  private getPreset() {
    return this.registerManager
      .getRegister(WebVMRegister)
      ?.getPreset(this.presetName)
  }

  private getChatStrategyProvider() {
    return this.registerManager
      .getRegister(ServerPluginRegister)
      ?.mentionServerPluginRegistry?.providerManagers.chatStrategy.mergeAll()
  }

  constructor(options: V1MessagesConstructorOptions) {
    this.chatContext = processConversationsForCreateMessage({
      chatContext: options.chatContext,
      registerManager: options.registerManager,
      newConversations: options.newConversations
    })
    this.registerManager = options.registerManager
    this.commandManager = options.commandManager
    this.currentWebPreviewProject = getDefaultWebPreviewProject(
      options.chatContext.conversations
    )
    this.presetName =
      this.currentWebPreviewProject?.presetName ??
      this.chatContext.settings.defaultV1PresetName ??
      defaultPresetName
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
    const preset = this.getPreset()
    if (!preset) return null

    return new SystemMessage({
      content: v1SystemPrompt(preset, this.currentWebPreviewProject)
    })
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
    // here we use the chat strategy provider to build the messages
    const chatStrategyProvider = this.getChatStrategyProvider()

    if (!chatStrategyProvider)
      throw new Error('Chat strategy provider not found')

    const messagePromises = this.chatContext.conversations.map(conversation =>
      new ConversationMessageConstructor({
        chatContext: this.chatContext,
        conversation,
        chatStrategyProvider
      }).buildMessages()
    )
    const messageArrays = await settledPromiseResults(messagePromises)
    return messageArrays.flat()
  }
}
