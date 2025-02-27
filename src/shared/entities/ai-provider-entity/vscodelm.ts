import type { TFunction } from 'i18next'

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

  getProviderConfig(t: TFunction): AIProviderConfig {
    return {
      name: t('shared.aiProvider.name.vscodelm'),
      fields: [
        {
          key: 'vscodeLmVendor',
          label: t('shared.aiProvider.fields.label.vscodeLmVendor'),
          required: true,
          disabled: false,
          defaultValue: 'copilot'
        }
      ]
    }
  }
}
