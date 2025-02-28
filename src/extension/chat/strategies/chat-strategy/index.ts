import type { ChatContext } from '@shared/entities'
import { UnPromise } from '@shared/types/common'

import { BaseStrategy, type ConvertToPromptType } from '../_base/base-strategy'
import { createChatWorkflow } from './chat-workflow'
import { ChatMessagesConstructor } from './messages-constructors/chat-messages-constructor'
import { type ChatGraphState } from './state'

export class ChatStrategy extends BaseStrategy<ChatGraphState> {
  private _chatWorkflow: UnPromise<
    ReturnType<typeof createChatWorkflow>
  > | null = null

  protected async getWorkflow() {
    if (!this._chatWorkflow) {
      this._chatWorkflow = await createChatWorkflow({
        registerManager: this.registerManager,
        commandManager: this.commandManager
      })
    }

    return this._chatWorkflow
  }

  async convertToPrompt(
    type: ConvertToPromptType,
    context: ChatContext,
    abortController?: AbortController
  ): Promise<string> {
    const chatMessagesConstructor = new ChatMessagesConstructor({
      ...this.baseStrategyOptions,
      chatContext: context,
      newConversations: [],
      mode: 'copyPrompt'
    })

    const messages = await chatMessagesConstructor.constructMessages()

    return this.messagesToPrompt(type, messages)
  }
}
