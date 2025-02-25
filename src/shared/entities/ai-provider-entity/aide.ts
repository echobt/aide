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

  getProviderConfig(): AIProviderConfig {
    return {
      name: 'Aide',
      fields: [
        {
          key: 'apiBaseUrl',
          label: 'Aide Base URL',
          required: true,
          disabled: false,
          defaultValue: 'https://api.zyai.online/v1'
        },
        {
          key: 'apiKey',
          label: 'Aide API Key',
          required: true,
          isSecret: true
        }
      ]
    }
  }
}
