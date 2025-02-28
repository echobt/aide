import { logger } from '@extension/logger'
import { ChatAnthropic } from '@langchain/anthropic'
import {
  ChatOpenAI,
  type ChatOpenAICallOptions,
  type ClientOptions as OpenAIClientOptions
} from '@langchain/openai'
import {
  AIProviderType,
  type AideProvider,
  type OpenAIProvider
} from '@shared/entities'
import { t } from 'i18next'
import OpenAI from 'openai'

import { aideKeyUsageInfo } from '../aide-key-request'
import { BaseModelProvider, type BaseModelUsageInfo } from './helpers/base'

export class AideModelProvider extends BaseModelProvider<
  ChatOpenAI<ChatOpenAICallOptions> | ChatAnthropic
> {
  createOpenaiClient(options?: OpenAIClientOptions) {
    const { extraFields } = this.aiProvider as OpenAIProvider
    const openai = new OpenAI({
      baseURL: extraFields.apiBaseUrl,
      apiKey: extraFields.apiKey,
      fetch,
      ...options
    })

    return openai
  }

  private async createLangChainAnthropicModel() {
    if (!this.aiModel?.name) {
      throw new Error(t('extension.modelProviders.errors.modelNameRequired'))
    }

    const { extraFields } = this.aiProvider as AideProvider
    // remove baseURL /v1
    const anthropicApiUrl = extraFields.apiBaseUrl.replace(/\/v1$/, '')

    const model = new ChatAnthropic({
      apiKey: extraFields.apiKey,
      anthropicApiUrl,
      clientOptions: {
        fetch,
        defaultHeaders: {
          Authorization: `Bearer ${extraFields.apiKey}`
        }
      },
      modelName: this.aiModel.name,
      temperature: 0.95,
      maxRetries: 6,
      verbose: this.isDev
    })

    return model
  }

  private async createLangChainOpenAIModel() {
    if (!this.aiModel?.name) {
      throw new Error(t('extension.modelProviders.errors.modelNameRequired'))
    }

    const { extraFields } = this.aiProvider as AideProvider

    const model = new ChatOpenAI({
      apiKey: extraFields.apiKey,
      configuration: {
        baseURL: extraFields.apiBaseUrl,
        fetch
      },
      modelName: this.aiModel.name,
      temperature: 0.95,
      maxRetries: 3,
      verbose: this.isDev
    })

    // Clear incompatible parameters for third-party models
    model.frequencyPenalty = undefined as any
    model.n = undefined as any
    model.presencePenalty = undefined as any
    model.topP = undefined as any

    return model
  }

  createLangChainModel() {
    const isAnthropicModels = /claude|anthropic/.test(this.aiModel?.name || '')

    if (isAnthropicModels) {
      return this.createLangChainAnthropicModel()
    }

    return this.createLangChainOpenAIModel()
  }

  async getSupportModelNames() {
    const openai = this.createOpenaiClient()
    const list = await openai.models.list()

    return list.data.map(model => model.id)
  }

  async getUsageInfo(): Promise<BaseModelUsageInfo | null> {
    try {
      // Ensure this is an Aide provider and has an API key
      if (this.aiProvider.type !== AIProviderType.Aide) {
        return null
      }
      const aideProvider = this.aiProvider as AideProvider
      const { apiKey } = aideProvider.extraFields

      if (!apiKey) return null

      const result = await aideKeyUsageInfo({ key: apiKey })

      if (!result.success) return null

      const { subscription } = result.data
      const totalUSD = subscription.hard_limit_usd
      const usedUSD =
        (subscription.used_quota / subscription.remain_quota) * totalUSD
      const remainUSD = totalUSD - usedUSD

      return {
        totalAmount: totalUSD,
        usedAmount: usedUSD,
        remainAmount: remainUSD,
        callTokenCount: result.data.count.count,
        validUntil: subscription.access_until,
        currency: 'USD'
      }
    } catch (error) {
      logger.error('Failed to fetch Aide usage info:', error)
      return null
    }
  }
}
