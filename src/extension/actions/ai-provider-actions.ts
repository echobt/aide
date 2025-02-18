import { aiProviderDB } from '@extension/lowdb/ai-provider-db'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { AIProvider } from '@shared/entities'

export class AIProviderActionsCollection extends ServerActionCollection {
  readonly categoryName = 'aiProvider'

  async getProviders(context: ActionContext<{}>) {
    const providers = await aiProviderDB.getAll()
    return providers.sort((a, b) => b.order - a.order)
  }

  async addProvider(context: ActionContext<Omit<AIProvider, 'id'>>) {
    const { actionParams } = context
    return await aiProviderDB.add(actionParams)
  }

  async updateProvider(
    context: ActionContext<Partial<AIProvider> & { id: string }>
  ) {
    const { actionParams } = context
    const { id, ...updates } = actionParams
    return await aiProviderDB.update(id, updates)
  }

  async updateProviders(
    context: ActionContext<Partial<AIProvider> & { id: string }[]>
  ) {
    const { actionParams } = context
    return await aiProviderDB.batchUpdate(actionParams)
  }

  async removeProvider(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    await aiProviderDB.remove(actionParams.id)
  }

  async removeProviders(context: ActionContext<{ id: string }[]>) {
    const { actionParams } = context
    return await aiProviderDB.batchRemove(actionParams.map(p => p.id))
  }
}
