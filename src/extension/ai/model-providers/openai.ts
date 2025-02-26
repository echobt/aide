import {
  ChatOpenAI,
  type ChatOpenAICallOptions,
  type ClientOptions
} from '@langchain/openai'
import type { OpenAIProvider } from '@shared/entities'
import { t } from 'i18next'
import OpenAI from 'openai'

import { BaseModelProvider } from './helpers/base'

export class OpenAIModelProvider extends BaseModelProvider<
  ChatOpenAI<ChatOpenAICallOptions>
> {
  createOpenaiClient(options?: ClientOptions) {
    const { extraFields } = this.aiProvider as OpenAIProvider
    const openai = new OpenAI({
      baseURL: extraFields.apiBaseUrl,
      apiKey: extraFields.apiKey,
      fetch,
      ...options
    })

    return openai
  }

  async createLangChainModel() {
    if (!this.aiModel?.name) {
      throw new Error(t('extension.modelProviders.errors.modelNameRequired'))
    }

    const { extraFields } = this.aiProvider as OpenAIProvider

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

  async getSupportModelNames() {
    const openai = this.createOpenaiClient()
    const list = await openai.models.list()

    return list.data.map(model => model.id)
  }
}
