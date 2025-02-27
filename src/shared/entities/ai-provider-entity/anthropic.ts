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
    anthropicApiUrl: string
    anthropicApiKey: string
  }
}

export class AnthropicProviderEntity extends AIProviderEntity<AnthropicProvider> {
  type = AIProviderType.Anthropic

  getProviderConfig(t: TFunction): AIProviderConfig {
    return {
      name: t('shared.aiProvider.name.anthropic'),
      fields: [
        {
          key: 'anthropicApiUrl',
          label: t('shared.aiProvider.fields.label.anthropicApiUrl'),
          required: true,
          disabled: true,
          defaultValue: 'https://api.anthropic.com'
        },
        {
          key: 'anthropicApiKey',
          label: t('shared.aiProvider.fields.label.anthropicApiKey'),
          required: true,
          isSecret: true
        }
      ]
    }
  }
}
