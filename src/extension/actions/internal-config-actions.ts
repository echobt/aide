import { internalConfigDB } from '@extension/lowdb/internal-config-db'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { InternalConfig } from '@shared/entities'

export class InternalConfigActionsCollection extends ServerActionCollection {
  readonly categoryName = 'internalConfig'

  async getConfig(context: ActionContext<{}>): Promise<InternalConfig> {
    return await internalConfigDB.getConfig()
  }

  async updateConfig(
    context: ActionContext<{ updates: Partial<InternalConfig> }>
  ): Promise<InternalConfig> {
    const { actionParams } = context
    const { updates } = actionParams
    return await internalConfigDB.updateConfig(updates)
  }
}
