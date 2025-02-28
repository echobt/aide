import { logger } from '@extension/logger'
import { aiProviderDB } from '@extension/lowdb/ai-provider-db'
import { runAction } from '@extension/state'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { FeatureModelSettingKey, type AIProvider } from '@shared/entities'

export class AIProviderActionsCollection extends ServerActionCollection {
  readonly categoryName = 'aiProvider'

  async getProviders(context: ActionContext<{}>) {
    const providers = await aiProviderDB.getAll()
    return providers.sort((a, b) => b.order - a.order)
  }

  async ensureDefaultProviderAndModel(
    context: ActionContext<{ provider: AIProvider }>
  ) {
    const { actionParams } = context
    const { provider } = actionParams
    const fallbackModelName =
      provider.manualModels.length > 0
        ? provider.manualModels[0]
        : provider.realTimeModels?.[0]

    if (!fallbackModelName) return

    try {
      const defaultProviderAndModel = await runAction(
        this.registerManager
      ).server.aiModel.getProviderAndModelForFeature({
        ...context,
        actionParams: {
          key: FeatureModelSettingKey.Default
        }
      })

      if (!defaultProviderAndModel.provider || !defaultProviderAndModel.model) {
        await runAction(
          this.registerManager
        ).server.aiModel.setModelSettingForFeature({
          ...context,
          actionParams: {
            key: FeatureModelSettingKey.Default,
            value: {
              providerId: provider.id,
              modelName: fallbackModelName
            }
          }
        })
      }

      return defaultProviderAndModel
    } catch (error) {
      logger.error('Failed to ensure default provider and model', error)
    }

    return null
  }

  async addProvider(context: ActionContext<Omit<AIProvider, 'id'>>) {
    const { actionParams } = context
    const provider = await aiProviderDB.add(actionParams)

    if (provider) {
      await this.ensureDefaultProviderAndModel({
        ...context,
        actionParams: {
          provider
        }
      })
    }

    return provider
  }

  async updateProvider(
    context: ActionContext<Partial<AIProvider> & { id: string }>
  ) {
    const { actionParams } = context
    const { id, ...updates } = actionParams
    const provider = await aiProviderDB.update(id, updates)

    if (provider) {
      await this.ensureDefaultProviderAndModel({
        ...context,
        actionParams: {
          provider
        }
      })
    }

    return provider
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
