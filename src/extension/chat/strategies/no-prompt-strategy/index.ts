/* eslint-disable @typescript-eslint/no-useless-constructor */
import type { ChatContext } from '@shared/entities'
import type { UnPromise } from '@shared/types/common'

import { BaseStrategy, type ConvertToPromptType } from '../_base'
import { NoPromptMessagesConstructor } from './messages-constructors/no-prompt-messages-constructor'
import { createNoPromptWorkflow } from './no-prompt-workflow'
import type { NoPromptGraphState } from './state'

export class NoPromptStrategy extends BaseStrategy<NoPromptGraphState> {
  private _noPromptWorkflow: UnPromise<
    ReturnType<typeof createNoPromptWorkflow>
  > | null = null

  protected async getWorkflow() {
    if (!this._noPromptWorkflow) {
      this._noPromptWorkflow = await createNoPromptWorkflow({
        registerManager: this.registerManager,
        commandManager: this.commandManager
      })
    }
    return this._noPromptWorkflow
  }

  async convertToPrompt(
    type: ConvertToPromptType,
    context: ChatContext,
    abortController?: AbortController
  ): Promise<string> {
    const noPromptMessagesConstructor = new NoPromptMessagesConstructor({
      ...this.baseStrategyOptions,
      chatContext: context,
      newConversations: [],
      mode: 'copyPrompt'
    })

    const messages = await noPromptMessagesConstructor.constructMessages()

    return this.messagesToPrompt(type, messages)
  }
}
