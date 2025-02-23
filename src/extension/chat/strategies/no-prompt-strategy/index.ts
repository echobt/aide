/* eslint-disable @typescript-eslint/no-useless-constructor */
import type { UnPromise } from '@shared/types/common'

import { BaseStrategy } from '../_base'
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
}
