import { ModelProviderFactory } from '@extension/ai/model-providers/helpers/factory'
import { aiModelDB } from '@extension/lowdb/ai-model-db'
import { aiProviderDB } from '@extension/lowdb/ai-provider-db'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import {
  AIProviderType,
  type AIModel,
  type AIModelFeature,
  type AIProvider,
  type FeatureModelSettingKey,
  type FeatureModelSettingValue
} from '@shared/entities'

export class AIModelActionsCollection extends ServerActionCollection {
  readonly categoryName = 'aiModel'

  async getModels(context: ActionContext<{}>) {
    return await aiModelDB.getAll()
  }

  async getModelsByProviderOrBaseUrl(
    context: ActionContext<{
      providerOrBaseUrl: AIProviderType | string
    }>
  ) {
    const { actionParams } = context
    const { providerOrBaseUrl } = actionParams
    const models = await aiModelDB.getAll()
    return models.filter(model => model.providerOrBaseUrl === providerOrBaseUrl)
  }

  async addModel(context: ActionContext<Omit<AIModel, 'id'>>) {
    const { actionParams } = context
    const { name, providerOrBaseUrl } = actionParams
    const all = await aiModelDB.getAll()
    const existingModel = all.find(
      model =>
        model.name === name && model.providerOrBaseUrl === providerOrBaseUrl
    )

    if (existingModel) return existingModel

    return await aiModelDB.add(actionParams)
  }

  async createOrUpdateModel(context: ActionContext<Partial<AIModel>>) {
    const { actionParams } = context
    return await aiModelDB.createOrUpdate(actionParams)
  }

  async batchCreateOrUpdateModels(context: ActionContext<Partial<AIModel>[]>) {
    const { actionParams } = context
    return await aiModelDB.batchCreateOrUpdate(actionParams)
  }

  async removeModel(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    await aiModelDB.remove(actionParams.id)
  }

  async fetchRemoteModelNames(
    context: ActionContext<{ provider: AIProvider }>
  ) {
    const { actionParams } = context
    const modelProvider = ModelProviderFactory.createProvider(
      actionParams.provider,
      undefined
    )
    return await modelProvider.getSupportModelNames()
  }

  async testModelFeatures(
    context: ActionContext<{
      provider: AIProvider
      model: AIModel
      features: AIModelFeature[]
    }>
  ) {
    const { actionParams } = context
    const { provider, model, features } = actionParams
    const modelProvider = ModelProviderFactory.createProvider(provider, model)

    return await modelProvider.testModelFeatures(features)
  }

  async getUsageInfo(context: ActionContext<{ provider: AIProvider }>) {
    const { actionParams } = context
    const { provider } = actionParams
    const modelProvider = ModelProviderFactory.createProvider(provider)
    return await modelProvider.getUsageInfo()
  }

  async getProviderAndModelForFeature(
    context: ActionContext<{ key: FeatureModelSettingKey }>
  ): Promise<{ provider?: AIProvider; model?: AIModel }> {
    const { actionParams } = context
    const { key } = actionParams
    const defaultResult = { provider: undefined, model: undefined }
    const setting = await ModelProviderFactory.getModelSettingForFeature(
      key,
      false
    )

    if (!setting) {
      return defaultResult
    }

    const provider = (await aiProviderDB.getAll()).find(
      p => p.id === setting.providerId
    )

    if (!provider) {
      return defaultResult
    }

    const model = (await aiModelDB.getAll()).find(
      m =>
        m.name === setting.modelName &&
        m.providerOrBaseUrl ===
          (provider.type === AIProviderType.Custom
            ? provider.extraFields.apiBaseUrl
            : provider.type)
    )

    if (!model) {
      return {
        ...defaultResult,
        provider
      }
    }

    return {
      provider,
      model
    }
  }

  async setModelSettingForFeature(
    context: ActionContext<{
      key: FeatureModelSettingKey
      value: FeatureModelSettingValue
    }>
  ) {
    const { actionParams } = context
    const { key, value } = actionParams
    return await ModelProviderFactory.setModelSettingForFeature(key, value)
  }
}
