import { UnPromise } from '@shared/types/common'

import { BaseStrategy } from '../_base/base-strategy'
import { createChatWorkflow } from './chat-workflow'
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
}
