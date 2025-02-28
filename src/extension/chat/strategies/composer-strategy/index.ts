/* eslint-disable @typescript-eslint/no-useless-constructor */
import type { ChatContext } from '@shared/entities'
import type { UnPromise } from '@shared/types/common'

import { BaseStrategy, type ConvertToPromptType } from '../_base'
import { createComposerWorkflow } from './composer-workflow'
import { ComposerMessagesConstructor } from './messages-constructors/composer-messages-constructor'
import type { ComposerGraphState } from './state'

export class ComposerStrategy extends BaseStrategy<ComposerGraphState> {
  private _composerWorkflow: UnPromise<
    ReturnType<typeof createComposerWorkflow>
  > | null = null

  protected async getWorkflow() {
    if (!this._composerWorkflow) {
      this._composerWorkflow = await createComposerWorkflow({
        registerManager: this.registerManager,
        commandManager: this.commandManager
      })
    }
    return this._composerWorkflow
  }

  async convertToPrompt(
    type: ConvertToPromptType,
    context: ChatContext,
    abortController?: AbortController
  ): Promise<string> {
    const composerMessagesConstructor = new ComposerMessagesConstructor({
      ...this.baseStrategyOptions,
      chatContext: context,
      newConversations: [],
      mode: 'copyPrompt'
    })

    const messages = await composerMessagesConstructor.constructMessages()

    return this.messagesToPrompt(type, messages)
  }
}
