import type { TFunction } from 'i18next'

import { ChatContextType } from '../chat-context-entity'
import { AideProviderEntity } from './aide'
import { AnthropicProviderEntity } from './anthropic'
import { AzureOpenAIProviderEntity } from './azure-openai'
import {
  AIProviderEntity,
  AIProviderType,
  type AIProvider,
  type AIProviderConfig
} from './base'
import { CustomProviderEntity } from './custom'
import { OpenAIProviderEntity } from './openai'
import { VSCodeLMProviderEntity } from './vscodelm'

export * from './base'
export * from './aide'
export * from './anthropic'
export * from './azure-openai'
export * from './custom'
export * from './openai'
export * from './vscodelm'
// Factory function to create the correct entity based on provider type
export function createAIProviderEntity(t: TFunction, type: AIProviderType) {
  switch (type) {
    case AIProviderType.Aide:
      return new AideProviderEntity(t)
    case AIProviderType.OpenAI:
      return new OpenAIProviderEntity(t)
    case AIProviderType.AzureOpenAI:
      return new AzureOpenAIProviderEntity(t)
    case AIProviderType.Anthropic:
      return new AnthropicProviderEntity(t)
    case AIProviderType.VSCodeLM:
      return new VSCodeLMProviderEntity(t)
    case AIProviderType.Custom:
      return new CustomProviderEntity(t)
    default:
      throw new Error(`Unknown provider type: ${type}`)
  }
}

export const createAllAIProviderConfigMap = (
  t: TFunction
): Record<AIProviderType, AIProviderConfig> => {
  const Entities = [
    AideProviderEntity,
    OpenAIProviderEntity,
    AzureOpenAIProviderEntity,
    AnthropicProviderEntity,
    CustomProviderEntity,
    VSCodeLMProviderEntity
  ]

  return Entities.reduce(
    (acc, Entity) => {
      const entity = new Entity(t)
      acc[entity.type] = entity.getProviderConfig(t)
      return acc
    },
    {} as Record<AIProviderType, AIProviderConfig>
  )
}

export class UnknownAIProviderEntity extends AIProviderEntity<AIProvider> {
  type = AIProviderType.Unknown

  getProviderConfig(t: TFunction): AIProviderConfig {
    return {
      name: '',
      fields: []
    }
  }
}

export enum FeatureModelSettingKey {
  Default = 'default',
  Chat = 'chat',
  Composer = 'composer',
  Agent = 'agent',
  V1 = 'v1',
  NoPrompt = 'no-prompt',
  Completion = 'completion',
  ApplyFile = 'applyFile',
  BatchProcessor = 'batchProcessor',
  CodeConvert = 'codeConvert',
  CodeViewerHelper = 'codeViewerHelper',
  ExpertCodeEnhancer = 'expertCodeEnhancer',
  RenameVariable = 'renameVariable',
  SmartPaste = 'smartPaste'
}

export interface FeatureModelSettingValue {
  providerId: string | undefined
  modelName: string | undefined
}

export const chatContextTypeModelSettingKeyMap: Record<
  ChatContextType,
  FeatureModelSettingKey
> = {
  [ChatContextType.Chat]: FeatureModelSettingKey.Chat,
  [ChatContextType.Composer]: FeatureModelSettingKey.Composer,
  [ChatContextType.V1]: FeatureModelSettingKey.V1,
  [ChatContextType.Agent]: FeatureModelSettingKey.Agent,
  [ChatContextType.NoPrompt]: FeatureModelSettingKey.NoPrompt
}

export const createModelSettingKeyTitleMap = (
  t: TFunction
): Record<FeatureModelSettingKey, string> => ({
  [FeatureModelSettingKey.Default]: t(
    'shared.aiProvider.featureModelSetting.default'
  ),
  [FeatureModelSettingKey.Chat]: t(
    'shared.aiProvider.featureModelSetting.chat'
  ),
  [FeatureModelSettingKey.Composer]: t(
    'shared.aiProvider.featureModelSetting.composer'
  ),
  [FeatureModelSettingKey.V1]: t('shared.aiProvider.featureModelSetting.v1'),
  [FeatureModelSettingKey.Agent]: t(
    'shared.aiProvider.featureModelSetting.agent'
  ),
  [FeatureModelSettingKey.NoPrompt]: t(
    'shared.aiProvider.featureModelSetting.noPrompt'
  ),
  [FeatureModelSettingKey.Completion]: t(
    'shared.aiProvider.featureModelSetting.completion'
  ),
  [FeatureModelSettingKey.ApplyFile]: t(
    'shared.aiProvider.featureModelSetting.applyFile'
  ),
  [FeatureModelSettingKey.BatchProcessor]: t(
    'shared.aiProvider.featureModelSetting.batchProcessor'
  ),
  [FeatureModelSettingKey.CodeConvert]: t(
    'shared.aiProvider.featureModelSetting.codeConvert'
  ),
  [FeatureModelSettingKey.CodeViewerHelper]: t(
    'shared.aiProvider.featureModelSetting.codeViewerHelper'
  ),
  [FeatureModelSettingKey.ExpertCodeEnhancer]: t(
    'shared.aiProvider.featureModelSetting.expertCodeEnhancer'
  ),
  [FeatureModelSettingKey.RenameVariable]: t(
    'shared.aiProvider.featureModelSetting.renameVariable'
  ),
  [FeatureModelSettingKey.SmartPaste]: t(
    'shared.aiProvider.featureModelSetting.smartPaste'
  )
})
