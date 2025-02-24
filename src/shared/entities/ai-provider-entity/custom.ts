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

  getProviderConfig(): AIProviderConfig {
    return {
      name: 'Custom',
      fields: [
        {
          key: 'apiBaseUrl',
          label: 'Custom Third-Party Base URL',
          required: true
        },
        {
          key: 'apiKey',
          label: 'Custom Third-Party API Key',
          required: true,
          isSecret: true
        }
      ]
    }
  }
}
