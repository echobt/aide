import { MessageBuilder } from '@extension/chat/utils/message-builder'
import { HumanMessage } from '@langchain/core/messages'
import type {
  ChatContext,
  Conversation,
  ConversationContents,
  LangchainMessage
} from '@shared/entities'
import type { MentionComposerStrategyProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import type { BuildPromptMode } from '../../_base'

interface ConversationMessageConstructorOptions {
  chatContext: ChatContext
  conversation: Conversation
  composerStrategyProvider: MentionComposerStrategyProvider
  mode: BuildPromptMode
}

export class ConversationMessageConstructor {
  private chatContext: ChatContext

  private conversation: Conversation

  private composerStrategyProvider: MentionComposerStrategyProvider

  private mode: BuildPromptMode

  constructor(options: ConversationMessageConstructorOptions) {
    this.chatContext = options.chatContext
    this.conversation = options.conversation
    this.composerStrategyProvider = options.composerStrategyProvider
    this.mode = options.mode
  }

  async buildMessages(): Promise<LangchainMessage[]> {
    if (this.conversation.role !== 'human') {
      if (!this.conversation.contents.length) return []

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
      (await this.composerStrategyProvider.buildContextMessagePrompt?.(
        this.mode,
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
      (await this.composerStrategyProvider.buildHumanMessagePrompt?.(
        this.mode,
        this.conversation,
        this.chatContext
      )) || ''

    const endPrompt =
      (await this.composerStrategyProvider.buildHumanMessageEndPrompt?.(
        this.mode,
        this.conversation,
        this.chatContext
      )) || ''

    const imageUrls =
      (await this.composerStrategyProvider.buildHumanMessageImageUrls?.(
        this.mode,
        this.conversation,
        this.chatContext
      )) || []

    const imageContents: ConversationContents =
      imageUrls.map(url => ({
        type: 'image_url',
        image_url: { url }
      })) || []

    let isEnhanced = false
    let enhancedContents: ConversationContents = this.conversation.contents.map(
      content => {
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
      }
    )

    if (!isEnhanced) {
      // no content found, so we need to add the prompt
      enhancedContents = [
        {
          type: 'text',
          text: `
${prompt}
${endPrompt}
`
        },
        ...enhancedContents
      ]
    }

    const finalContents = [...enhancedContents, ...imageContents]

    return new HumanMessage({ content: finalContents })
  }
}
