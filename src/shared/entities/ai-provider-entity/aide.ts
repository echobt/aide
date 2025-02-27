import type { TFunction } from 'i18next'

import {
  AIProviderEntity,
  AIProviderType,
  type AIProvider,
  type AIProviderConfig
} from './base'

// Provider specific interfaces with typed extraFields
export interface AideProvider extends AIProvider {
  type: AIProviderType.Aide
  extraFields: {
    apiBaseUrl: string
    apiKey: string
  }
}

// Provider specific entities
export class AideProviderEntity extends AIProviderEntity<AideProvider> {
  type = AIProviderType.Aide

  getProviderConfig(t: TFunction): AIProviderConfig {
    return {
      name: t('shared.aiProvider.name.aide'),
      fields: [
        {
          key: 'apiBaseUrl',
          label: t('shared.aiProvider.fields.label.aideApiBaseUrl'),
          required: true,
          disabled: false,
          defaultValue: 'https://api.zyai.online/v1'
        },
        {
          key: 'apiKey',
          label: t('shared.aiProvider.fields.label.aideApiKey'),
          required: true,
          isSecret: true
        }
      ]
    }
  }
}
