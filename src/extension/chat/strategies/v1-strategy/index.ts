import type { UnPromise } from '@shared/types/common'

import { BaseStrategy } from '../_base/base-strategy'
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
}
