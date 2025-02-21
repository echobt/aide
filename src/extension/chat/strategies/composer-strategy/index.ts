/* eslint-disable @typescript-eslint/no-useless-constructor */
import type { UnPromise } from '@shared/types/common'

import { BaseStrategy } from '../_base'
import { createComposerWorkflow } from './composer-workflow'
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
}
