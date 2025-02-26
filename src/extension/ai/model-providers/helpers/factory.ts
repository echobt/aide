import { aiModelDB } from '@extension/lowdb/ai-model-db'
import { aiProviderDB } from '@extension/lowdb/ai-provider-db'
import { globalSettingsDB } from '@extension/lowdb/settings-db'
import { normalizeLineEndings } from '@extension/utils'
import type { MessageContent } from '@langchain/core/messages'
import type { AIModel, ChatContext } from '@shared/entities'
import {
  AIProvider,
  AIProviderType,
  chatContextTypeModelSettingKeyMap,
  FeatureModelSettingKey,
  FeatureModelSettingValue
} from '@shared/entities'
import { t } from 'i18next'

import { AideModelProvider } from '../aide'
import { AnthropicModelProvider } from '../anthropic'
import { AzureOpenAIModelProvider } from '../azure-openai'
import { OpenAIModelProvider } from '../openai'
import { VSCodeLMModelProvider } from '../vscodelm'

export class ModelProviderFactory {
  static async create(setting: FeatureModelSettingValue) {
    const { providerId, modelName } = setting

    // Get provider and model from DB
    const provider = (await aiProviderDB.getAll()).find(
      p => p.id === providerId
    )

    if (!provider) {
      throw new Error(
        t('extension.modelProviders.errors.providerNotFound', { providerId })
      )
    }

    const model = (await aiModelDB.getAll()).find(
      m =>
        m.name === modelName &&
        m.providerOrBaseUrl ===
          (provider.type === AIProviderType.Custom
            ? provider.extraFields.apiBaseUrl
            : provider.type)
    )

    if (!modelName) {
      throw new Error(t('extension.modelProviders.errors.modelNameRequired'))
    }

    if (!model) {
      throw new Error(
        t('extension.modelProviders.errors.modelNotFound', { modelName })
      )
    }

    // Create appropriate provider instance
    return ModelProviderFactory.createProvider(provider, model)
  }

  static createProvider(provider: AIProvider, model?: AIModel) {
    switch (provider.type) {
      case AIProviderType.Aide:
        return new AideModelProvider(provider, model)
      case AIProviderType.OpenAI:
      case AIProviderType.Custom:
        return new OpenAIModelProvider(provider, model)
      case AIProviderType.AzureOpenAI:
        return new AzureOpenAIModelProvider(provider, model)
      case AIProviderType.Anthropic:
        return new AnthropicModelProvider(provider, model)
      case AIProviderType.VSCodeLM:
        return new VSCodeLMModelProvider(provider, model)
      default:
        throw new Error(
          t('extension.modelProviders.errors.unsupportedProviderType', {
            type: provider.type
          })
        )
    }
  }

  static formatMessageContent(content: MessageContent): string {
    if (typeof content === 'string') return normalizeLineEndings(content)

    return normalizeLineEndings(
      content
        .map(c => {
          if (c.type === 'text') return c.text
          return ''
        })
        .join('')
    )
  }

  static async getModelProvider(key: FeatureModelSettingKey) {
    const setting = await this.getModelSettingForFeature(key)

    if (!setting) {
      throw new Error(
        t('extension.modelProviders.errors.missingProviderOrModel')
      )
    }

    return await this.create(setting)
  }

  static async getModelProviderForChatContext(chatContext: ChatContext) {
    const chatContextType = chatContext.type
    const modelSettingKey = chatContextTypeModelSettingKeyMap[chatContextType]
    return await this.getModelProvider(modelSettingKey)
  }

  static async getModelSettingForFeature(
    key: FeatureModelSettingKey,
    useDefault = true
  ) {
    const settings: Record<
      FeatureModelSettingKey,
      FeatureModelSettingValue
    > | null = await globalSettingsDB.getSetting('models')

    const isExtendsDefault =
      !settings?.[key]?.providerId && !settings?.[key]?.modelName

    const defaultSetting = settings?.[FeatureModelSettingKey.Default]

    if (isExtendsDefault && useDefault && !defaultSetting) {
      throw new Error(
        t('extension.modelProviders.errors.missingProviderOrModel')
      )
    }

    const setting =
      isExtendsDefault && useDefault ? defaultSetting : settings?.[key]

    return setting
  }

  static async setModelSettingForFeature(
    key: FeatureModelSettingKey,
    value: FeatureModelSettingValue
  ) {
    const oldSettings: Record<
      FeatureModelSettingKey,
      FeatureModelSettingValue
    > | null = await globalSettingsDB.getSetting('models')

    await globalSettingsDB.setSetting('models', {
      ...oldSettings,
      [key]: value
    })
  }
}
