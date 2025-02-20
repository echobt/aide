import {
  AIProviderEntity,
  AIProviderType,
  type AIProvider,
  type AIProviderConfig
} from './base'

// Provider specific interfaces with typed extraFields
export interface VSCodeLMProvider extends AIProvider {
  type: AIProviderType.VSCodeLM
  extraFields: {
    vscodeLmVendor: string
  }
}

// Provider specific entities
export class VSCodeLMProviderEntity extends AIProviderEntity<VSCodeLMProvider> {
  type = AIProviderType.VSCodeLM

  getProviderConfig(): AIProviderConfig {
    return {
      name: 'VSCodeLM',
      fields: [
        {
          key: 'vscodeLmVendor',
          label: 'VSCodeLM Vendor',
          required: true,
          disabled: false,
          defaultValue: 'copilot'
        }
      ]
    }
  }
}
