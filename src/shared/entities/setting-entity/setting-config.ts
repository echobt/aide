import type { TFunction } from 'i18next'

import * as settingItemsConfig from './setting-items-config'
import {
  createAboutConfig,
  createAdditionalGitIgnoreConfig,
  createAiPromptConfig,
  createApiConcurrencyConfig,
  createAutoRememberConvertLanguagePairsConfig,
  createChatModelConfig,
  createCodebaseIndexingConfig,
  createCodeConvertModelConfig,
  createCodeViewerHelperModelConfig,
  createCodeViewerHelperPromptConfig,
  createComposerModelConfig,
  createConvertLanguagePairsConfig,
  createDefaultModelConfig,
  createDocManagementConfig,
  createExpertCodeEnhancerModelConfig,
  createExpertCodeEnhancerPromptListConfig,
  createGitExecutablePathConfig,
  createGitProjectManagementConfig,
  createLanguageConfig,
  createMcpManagementConfig,
  createModelsConfig,
  createProjectManagementConfig,
  createPromptSnippetConfig,
  createReadClipboardImageConfig,
  createRespectGitIgnoreConfig,
  createRulesForAIConfig,
  createSmartPasteModelConfig,
  createThemeConfig,
  createUseSystemProxyConfig,
  createV1ModelConfig
} from './setting-items-config'
import type { SettingConfig, SettingConfigItem } from './types'

// Setting groups and pages configuration
export const createSettingsConfig = (t: TFunction): SettingConfig => ({
  pages: [
    {
      id: 'general',
      label: t('shared.settings.general.label'),
      settings: [
        createLanguageConfig(t),
        createThemeConfig(t),
        createRulesForAIConfig(t),
        createRespectGitIgnoreConfig(t),
        createAdditionalGitIgnoreConfig(t),
        createUseSystemProxyConfig(t),
        createDefaultModelConfig(t),
        createChatModelConfig(t),
        createComposerModelConfig(t),
        createV1ModelConfig(t)
      ]
    },
    {
      id: 'about',
      label: t('shared.settings.about.label'),
      settings: [createAboutConfig(t)]
    }
  ],
  groups: [
    {
      id: 'chat',
      label: t('shared.settings.chat.label'),
      pages: [
        {
          id: 'chatModel',
          label: t('shared.settings.chat.chatModel.label'),
          settings: [createModelsConfig(t)]
        },
        {
          id: 'codebaseIndexing',
          label: t('shared.settings.chat.codebaseIndexing.label'),
          settings: [createCodebaseIndexingConfig(t)]
        },
        {
          id: 'mcpManagement',
          label: t('shared.settings.chat.mcpManagement.label'),
          settings: [createMcpManagementConfig(t)]
        },
        {
          id: 'chatDoc',
          label: t('shared.settings.chat.chatDoc.label'),
          settings: [createDocManagementConfig(t)]
        },
        {
          id: 'promptSnippets',
          label: t('shared.settings.chat.promptSnippets.label'),
          settings: [createPromptSnippetConfig(t)]
        },
        {
          id: 'projectManagement',
          label: t('shared.settings.chat.projectManagement.label'),
          settings: [createProjectManagementConfig(t)]
        },
        {
          id: 'gitProjectManagement',
          label: t('shared.settings.chat.gitProjectManagement.label'),
          settings: [
            createGitExecutablePathConfig(t),
            createGitProjectManagementConfig(t)
          ]
        }
      ]
    },
    {
      id: 'tools',
      label: t('shared.settings.tools.label'),
      pages: [
        {
          id: 'copyAsPrompt',
          label: t('shared.settings.tools.copyAsPrompt.label'),
          settings: [createAiPromptConfig(t)]
        },
        {
          id: 'codeConvert',
          label: t('shared.settings.tools.codeConvert.label'),
          settings: [
            createCodeConvertModelConfig(t),
            createConvertLanguagePairsConfig(t),
            createAutoRememberConvertLanguagePairsConfig(t)
          ]
        },
        {
          id: 'codeViewerHelper',
          label: t('shared.settings.tools.codeViewerHelper.label'),
          settings: [
            createCodeViewerHelperModelConfig(t),
            createCodeViewerHelperPromptConfig(t)
          ]
        },
        {
          id: 'expertCodeEnhancer',
          label: t('shared.settings.tools.expertCodeEnhancer.label'),
          settings: [
            createExpertCodeEnhancerModelConfig(t),
            createExpertCodeEnhancerPromptListConfig(t)
          ]
        },
        {
          id: 'smartPaste',
          label: t('shared.settings.tools.smartPaste.label'),
          settings: [
            createSmartPasteModelConfig(t),
            createReadClipboardImageConfig(t)
          ]
        },
        {
          id: 'batchProcessor',
          label: t('shared.settings.tools.batchProcessor.label'),
          settings: [createApiConcurrencyConfig(t)]
        }
      ]
    }
  ]
})

type CreateSettingItemsConfigs = typeof settingItemsConfig
type SettingItemsConfig = {
  [K in keyof CreateSettingItemsConfigs]: CreateSettingItemsConfigs[K] extends (
    ...args: any[]
  ) => infer R
    ? R
    : never
}[keyof CreateSettingItemsConfigs]
export type SettingKey = SettingItemsConfig['key']

export type GlobalSettingKey = Extract<
  SettingItemsConfig,
  { saveType: 'global' }
>['key']

export type WorkspaceSettingKey = Extract<
  SettingItemsConfig,
  { saveType: 'workspace' }
>['key']

type SettingItemConfigFromKey<K extends SettingKey> = SettingConfigItem<
  Extract<SettingItemsConfig, { key: K }>['renderOptions']['type']
>

export type SettingValue<K extends SettingKey> =
  SettingItemConfigFromKey<K>['renderOptions']['defaultValue']

export const createSettingKeyItemConfigMap = (t: TFunction) =>
  Object.values(settingItemsConfig).reduce(
    (acc, createItem) => {
      const item = createItem(t)
      acc[item.key] = item as any
      return acc
    },
    {} as {
      [K in SettingKey]: SettingItemConfigFromKey<K>
    }
  )
