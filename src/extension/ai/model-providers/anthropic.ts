import Anthropic, { ClientOptions } from '@anthropic-ai/sdk'
import { ChatAnthropic } from '@langchain/anthropic'
import type { AnthropicProvider } from '@shared/entities'
import { t } from 'i18next'

import { BaseModelProvider } from './helpers/base'

interface AnthropicModel {
  id: string
}

export class AnthropicModelProvider extends BaseModelProvider<ChatAnthropic> {
  createAnthropicClient(options?: ClientOptions) {
    const { extraFields } = this.aiProvider as AnthropicProvider

    return new Anthropic({
      apiKey: extraFields.anthropicApiKey,
      baseURL: extraFields.anthropicApiUrl,
      fetch,
      ...options
    })
  }

  async createLangChainModel() {
    if (!this.aiModel?.name) {
      throw new Error(t('extension.modelProviders.errors.modelNameRequired'))
    }

    const { extraFields } = this.aiProvider as AnthropicProvider

    const model = new ChatAnthropic({
      apiKey: extraFields.anthropicApiKey,
      anthropicApiUrl: extraFields.anthropicApiUrl,
      clientOptions: {
        fetch
      },
      modelName: this.aiModel.name,
      temperature: 0.95,
      maxRetries: 6,
      verbose: this.isDev
    })

    return model
  }

  async getSupportModelNames() {
    const anthropic = this.createAnthropicClient()
    const list = await anthropic.get<any, AnthropicModel[]>('/v1/models')

    return list.map(model => model.id)
  }
}
