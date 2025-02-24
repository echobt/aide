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

  getProviderConfig(): AIProviderConfig {
    return {
      name: 'OpenAI',
      fields: [
        {
          key: 'apiBaseUrl',
          label: 'OpenAI Base URL',
          required: true,
          disabled: true,
          defaultValue: 'https://api.openai.com/v1'
        },
        {
          key: 'apiKey',
          label: 'OpenAI API Key',
          required: true,
          isSecret: true
        }
      ]
    }
  }
}
