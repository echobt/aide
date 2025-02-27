import type { TFunction } from 'i18next'

import {
  AIProviderEntity,
  AIProviderType,
  type AIProvider,
  type AIProviderConfig
} from './base'

export interface AzureOpenAIProvider extends AIProvider {
  type: AIProviderType.AzureOpenAI
  extraFields: {
    azureOpenaiBasePath: string
    azureOpenaiApiKey: string
    azureOpenaiApiVersion: string
    azureOpenaiApiDeploymentName: string
  }
}

export class AzureOpenAIProviderEntity extends AIProviderEntity<AzureOpenAIProvider> {
  type = AIProviderType.AzureOpenAI

  getProviderConfig(t: TFunction): AIProviderConfig {
    return {
      name: t('shared.aiProvider.name.azureOpenai'),
      fields: [
        {
          key: 'azureOpenaiBasePath',
          label: t('shared.aiProvider.fields.label.azureOpenaiBasePath'),
          required: true
        },
        {
          key: 'azureOpenaiApiKey',
          label: t('shared.aiProvider.fields.label.azureOpenaiApiKey'),
          required: true,
          isSecret: true
        },
        {
          key: 'azureOpenaiApiVersion',
          label: t('shared.aiProvider.fields.label.azureOpenaiApiVersion'),
          required: true
        },
        {
          key: 'azureOpenaiApiDeploymentName',
          label: t(
            'shared.aiProvider.fields.label.azureOpenaiApiDeploymentName'
          ),
          required: true
        }
      ]
    }
  }
}
