import type { ChatContext } from '@shared/entities'
import type { UnPromise } from '@shared/types/common'

import { BaseStrategy, type ConvertToPromptType } from '../_base/base-strategy'
import { V1MessagesConstructor } from './messages-constructors/v1-messages-constructor'
import type { V1GraphState } from './state'
import { createV1Workflow } from './v1-workflow'

export class V1Strategy extends BaseStrategy<V1GraphState> {
  private _v1Workflow: UnPromise<ReturnType<typeof createV1Workflow>> | null =
    null

  protected async getWorkflow() {
    if (!this._v1Workflow) {
      this._v1Workflow = await createV1Workflow({
        registerManager: this.registerManager,
        commandManager: this.commandManager
      })
    }
    return this._v1Workflow
  }

  async convertToPrompt(
    type: ConvertToPromptType,
    context: ChatContext,
    abortController?: AbortController
  ): Promise<string> {
    const v1MessagesConstructor = new V1MessagesConstructor({
      ...this.baseStrategyOptions,
      chatContext: context,
      newConversations: [],
      mode: 'copyPrompt'
    })

    const messages = await v1MessagesConstructor.constructMessages()

    return this.messagesToPrompt(type, messages)
  }
}
