import type { TFunction } from 'i18next'

import {
  AIProviderEntity,
  AIProviderType,
  type AIProvider,
  type AIProviderConfig
} from './base'

// Provider specific interfaces with typed extraFields
export interface OpenAIProvider extends AIProvider {
  type: AIProviderType.OpenAI
  extraFields: {
    apiBaseUrl: string
    apiKey: string
  }
}

// Provider specific entities
export class OpenAIProviderEntity extends AIProviderEntity<OpenAIProvider> {
  type = AIProviderType.OpenAI

  getProviderConfig(t: TFunction): AIProviderConfig {
    return {
      name: t('shared.aiProvider.name.openai'),
      fields: [
        {
          key: 'apiBaseUrl',
          label: t('shared.aiProvider.fields.label.openaiApiBaseUrl'),
          required: true,
          disabled: false,
          defaultValue: 'https://api.openai.com/v1'
        },
        {
          key: 'apiKey',
          label: t('shared.aiProvider.fields.label.openaiApiKey'),
          required: true,
          isSecret: true
        }
      ]
    }
  }
}
