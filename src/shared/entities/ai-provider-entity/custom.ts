import type { TFunction } from 'i18next'

import {
  AIProviderEntity,
  AIProviderType,
  type AIProvider,
  type AIProviderConfig
} from './base'

export interface CustomProvider extends AIProvider {
  type: AIProviderType.Custom
  extraFields: {
    apiBaseUrl: string
    apiKey: string
  }
}
export class CustomProviderEntity extends AIProviderEntity<CustomProvider> {
  type = AIProviderType.Custom

  getProviderConfig(t: TFunction): AIProviderConfig {
    return {
      name: t('shared.aiProvider.name.custom'),
      fields: [
        {
          key: 'apiBaseUrl',
          label: t('shared.aiProvider.fields.label.customApiBaseUrl'),
          required: true
        },
        {
          key: 'apiKey',
          label: t('shared.aiProvider.fields.label.customApiKey'),
          required: true,
          isSecret: true
        }
      ]
    }
  }
}
