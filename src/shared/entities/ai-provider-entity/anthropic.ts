import type { TFunction } from 'i18next'

import {
  AIProviderEntity,
  AIProviderType,
  type AIProvider,
  type AIProviderConfig
} from './base'

export interface AnthropicProvider extends AIProvider {
  type: AIProviderType.Anthropic
  extraFields: {
    apiBaseUrl: string
    apiKey: string
  }
}

export class AnthropicProviderEntity extends AIProviderEntity<AnthropicProvider> {
  type = AIProviderType.Anthropic

  getProviderConfig(t: TFunction): AIProviderConfig {
    return {
      name: t('shared.aiProvider.name.anthropic'),
      fields: [
        {
          key: 'apiBaseUrl',
          label: t('shared.aiProvider.fields.label.anthropicApiUrl'),
          required: true,
          disabled: false,
          defaultValue: 'https://api.anthropic.com'
        },
        {
          key: 'apiKey',
          label: t('shared.aiProvider.fields.label.anthropicApiKey'),
          required: true,
          isSecret: true
        }
      ]
    }
  }
}
