import { MessageBuilder } from '@extension/chat/utils/message-builder'
import { HumanMessage } from '@langchain/core/messages'
import type {
  ChatContext,
  Conversation,
  ConversationContents,
  LangchainMessage
} from '@shared/entities'
import type { MentionNoPromptStrategyProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

interface ConversationMessageConstructorOptions {
  chatContext: ChatContext
  conversation: Conversation
  noPromptStrategyProvider: MentionNoPromptStrategyProvider
}

export class ConversationMessageConstructor {
  private chatContext: ChatContext

  private conversation: Conversation

  private noPromptStrategyProvider: MentionNoPromptStrategyProvider

  constructor(options: ConversationMessageConstructorOptions) {
    this.chatContext = options.chatContext
    this.conversation = options.conversation
    this.noPromptStrategyProvider = options.noPromptStrategyProvider
  }

  async buildMessages(): Promise<LangchainMessage[]> {
    if (this.conversation.role !== 'human') {
      return [
        MessageBuilder.createMessage(
          this.conversation.role,
          this.conversation.contents
        )
      ].filter(Boolean) as LangchainMessage[]
    }

    const contextMessage = await this.buildContextMessage()
    const humanMessage = await this.buildHumanMessage()

    return [contextMessage, humanMessage].filter(Boolean) as LangchainMessage[]
  }

  private async buildContextMessage(): Promise<HumanMessage | null> {
    const prompt =
      (await this.noPromptStrategyProvider.buildContextMessagePrompt?.(
        this.conversation,
        this.chatContext
      )) || ''

    if (!prompt.trim()) return null

    return new HumanMessage({
      content: `
# Inputs

${prompt}
`
    })
  }

  private async buildHumanMessage(): Promise<HumanMessage> {
    const prompt =
      (await this.noPromptStrategyProvider.buildHumanMessagePrompt?.(
        this.conversation,
        this.chatContext
      )) || ''

    const endPrompt =
      (await this.noPromptStrategyProvider.buildHumanMessageEndPrompt?.(
        this.conversation,
        this.chatContext
      )) || ''

    const imageUrls =
      (await this.noPromptStrategyProvider.buildHumanMessageImageUrls?.(
        this.conversation,
        this.chatContext
      )) || []

    const imageContents: ConversationContents =
      imageUrls.map(url => ({
        type: 'image_url',
        image_url: { url }
      })) || []

    let isEnhanced = false
    const enhancedContents: ConversationContents = this.conversation.contents
      .map(content => {
        if (content.type === 'text' && !isEnhanced) {
          isEnhanced = true
          return {
            ...content,
            text: `
${prompt}
${content.text}
${endPrompt}
`
          }
        }
        return content
      })
      .concat(...imageContents)

    return new HumanMessage({ content: enhancedContents })
  }
}
