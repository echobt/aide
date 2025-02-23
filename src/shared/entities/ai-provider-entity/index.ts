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
export function createAIProviderEntity(type: AIProviderType) {
  switch (type) {
    case AIProviderType.Aide:
      return new AideProviderEntity()
    case AIProviderType.OpenAI:
      return new OpenAIProviderEntity()
    case AIProviderType.AzureOpenAI:
      return new AzureOpenAIProviderEntity()
    case AIProviderType.Anthropic:
      return new AnthropicProviderEntity()
    case AIProviderType.VSCodeLM:
      return new VSCodeLMProviderEntity()
    case AIProviderType.Custom:
      return new CustomProviderEntity()
    default:
      throw new Error(`Unknown provider type: ${type}`)
  }
}

export const getAllAIProviderConfigMap = (): Record<
  AIProviderType,
  AIProviderConfig
> => {
  const Entities = [
    AideProviderEntity,
    OpenAIProviderEntity,
    AzureOpenAIProviderEntity,
    AnthropicProviderEntity,
    CustomProviderEntity

    // FIXME: vscode.lm not allow use lm models outside of the ChatParticipant
    // Need to wait for the vscode.lm to support it
    // VSCodeLMProviderEntity
  ]

  return Entities.reduce(
    (acc, Entity) => {
      const entity = new Entity()
      acc[entity.type] = entity.getProviderConfig()
      return acc
    },
    {} as Record<AIProviderType, AIProviderConfig>
  )
}

export class UnknownAIProviderEntity extends AIProviderEntity<AIProvider> {
  type = AIProviderType.Unknown

  getProviderConfig(): AIProviderConfig {
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

export const modelSettingKeyTitleMap: Record<FeatureModelSettingKey, string> = {
  [FeatureModelSettingKey.Default]: 'Default Model',
  [FeatureModelSettingKey.Chat]: 'Chat Model',
  [FeatureModelSettingKey.Composer]: 'Composer Model',
  [FeatureModelSettingKey.V1]: 'V1 Model',
  [FeatureModelSettingKey.Agent]: 'Agent Model',
  [FeatureModelSettingKey.NoPrompt]: 'No Prompt Model',
  [FeatureModelSettingKey.Completion]: 'Completion Model',
  [FeatureModelSettingKey.ApplyFile]: 'Apply File Model',
  [FeatureModelSettingKey.BatchProcessor]: 'Batch Processor Model',
  [FeatureModelSettingKey.CodeConvert]: 'Code Convert Model',
  [FeatureModelSettingKey.CodeViewerHelper]: 'Code Viewer Helper Model',
  [FeatureModelSettingKey.ExpertCodeEnhancer]: 'Expert Code Enhancer Model',
  [FeatureModelSettingKey.RenameVariable]: 'Rename Variable Model',
  [FeatureModelSettingKey.SmartPaste]: 'Smart Paste Model'
}
