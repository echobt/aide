import type { TFunction } from 'i18next'

import {
  createModelSettingKeyTitleMap,
  FeatureModelSettingKey
} from '../ai-provider-entity'
import type { SettingConfigItem } from './types'

export const createLanguageConfig = (t: TFunction) =>
  ({
    key: 'language',
    saveType: 'global',
    renderOptions: {
      type: 'languageSelector',
      label: t('shared.settings.general.language.label'),
      description: t('shared.settings.general.language.description'),
      defaultValue: ''
    }
  }) as const satisfies SettingConfigItem<'languageSelector'>

export const createThemeConfig = (t: TFunction) =>
  ({
    key: 'theme',
    saveType: 'global',
    renderOptions: {
      type: 'themeSelector',
      label: t('shared.settings.general.theme.label'),
      description: t('shared.settings.general.theme.description'),
      defaultValue: ''
    }
  }) as const satisfies SettingConfigItem<'themeSelector'>

// General settings
export const createApiConcurrencyConfig = (t: TFunction) =>
  ({
    key: 'apiConcurrency',
    saveType: 'global',
    renderOptions: {
      type: 'numberInput',
      label: t('shared.settings.tools.batchProcessor.apiConcurrency.label'),
      description: t(
        'shared.settings.tools.batchProcessor.apiConcurrency.description'
      ),
      defaultValue: 3
    }
  }) as const satisfies SettingConfigItem<'numberInput'>

export const createRulesForAIConfig = (t: TFunction) =>
  ({
    key: 'rulesForAI',
    saveType: 'global',
    renderOptions: {
      type: 'textarea',
      label: t('shared.settings.general.rulesForAI.label'),
      description: t('shared.settings.general.rulesForAI.description'),
      placeholder: t('shared.settings.general.rulesForAI.placeholder'),
      defaultValue: ''
    }
  }) as const satisfies SettingConfigItem<'textarea'>

export const createUseSystemProxyConfig = (t: TFunction) =>
  ({
    key: 'useSystemProxy',
    saveType: 'global',
    renderOptions: {
      type: 'switch',
      label: t('shared.settings.general.useSystemProxy.label'),
      description: t('shared.settings.general.useSystemProxy.description'),
      defaultValue: false
    }
  }) as const satisfies SettingConfigItem<'switch'>

export const createAdditionalGitIgnoreConfig = (t: TFunction) =>
  ({
    key: 'additionalGitIgnore',
    saveType: 'workspace',
    renderOptions: {
      type: 'textarea',
      label: t('shared.settings.general.additionalGitIgnore.label'),
      description: t('shared.settings.general.additionalGitIgnore.description'),
      placeholder: t('shared.settings.general.additionalGitIgnore.placeholder'),
      defaultValue: `# Dependencies
node_modules/
__pycache__/
.Python/
site-packages/
gems/
.gradle/

# Build outputs
dist/
build/
Build/
target/
out/
bin/

# Cache and temp
.cache/
.next/
.nuxt/
.parcel-cache/
.pytest_cache/
.continue/
.vscode-test/

# IDE and editors
.vscode/
.idea/
.vs/

# Environment
venv/
.venv/
env/
.env/

# Version control
.git/
.svn/

# System
.DS_Store`
    }
  }) as const satisfies SettingConfigItem<'textarea'>

export const createRespectGitIgnoreConfig = (t: TFunction) =>
  ({
    key: 'respectGitIgnore',
    saveType: 'workspace',
    renderOptions: {
      type: 'switch',
      label: t('shared.settings.general.respectGitIgnore.label'),
      description: t('shared.settings.general.respectGitIgnore.description'),
      defaultValue: true
    }
  }) as const satisfies SettingConfigItem<'switch'>

export const createCodebaseIndexingConfig = (t: TFunction) =>
  ({
    key: 'codebaseIndexing',
    saveType: 'workspace',
    renderOptions: {
      type: 'codebaseIndexing',
      label: t('shared.settings.chat.codebaseIndexing.label'),
      hideLabel: true,
      description: t('shared.settings.chat.codebaseIndexing.description'),
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'codebaseIndexing'>

export const createMcpManagementConfig = (t: TFunction) =>
  ({
    key: 'mcpManagement',
    saveType: 'global',
    renderOptions: {
      type: 'mcpManagement',
      label: t('shared.settings.chat.mcpManagement.label'),
      hideLabel: true,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'mcpManagement'>

// Chat settings
export const createModelsConfig = (t: TFunction) =>
  ({
    key: 'models',
    saveType: 'global',
    renderOptions: {
      type: 'modelManagement',
      label: t('shared.settings.chat.chatModel.label'),
      hideLabel: true,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelManagement'>

export const createDocManagementConfig = (t: TFunction) =>
  ({
    key: 'docManagement',
    saveType: 'global',
    renderOptions: {
      type: 'docManagement',
      label: t('shared.settings.chat.chatDoc.label'),
      hideLabel: true,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'docManagement'>

export const createPromptSnippetConfig = (t: TFunction) =>
  ({
    key: 'promptSnippet',
    saveType: 'global',
    renderOptions: {
      type: 'promptSnippetManagement',
      label: t('shared.settings.chat.promptSnippets.label'),
      hideLabel: true,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'promptSnippetManagement'>

export const createProjectManagementConfig = (t: TFunction) =>
  ({
    key: 'projectManagement',
    saveType: 'global',
    renderOptions: {
      type: 'projectManagement',
      label: t('shared.settings.chat.projectManagement.label'),
      hideLabel: true,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'projectManagement'>

export const createGitExecutablePathConfig = (t: TFunction) =>
  ({
    key: 'gitExecutablePath',
    saveType: 'global',
    renderOptions: {
      type: 'input',
      label: t('shared.settings.chat.gitExecutablePath.label'),
      description: t('shared.settings.chat.gitExecutablePath.description'),
      placeholder: t('shared.settings.chat.gitExecutablePath.placeholder'),
      defaultValue: ''
    }
  }) as const satisfies SettingConfigItem<'input'>

export const createGitProjectManagementConfig = (t: TFunction) =>
  ({
    key: 'gitProjectManagement',
    saveType: 'global',
    renderOptions: {
      type: 'gitProjectManagement',
      label: t('shared.settings.chat.gitProjectManagement.label'),
      hideLabel: true,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'gitProjectManagement'>

// Tool settings
export const createAiPromptConfig = (t: TFunction) =>
  ({
    key: 'aiPrompt',
    saveType: 'global',
    renderOptions: {
      type: 'textarea',
      label: t('shared.settings.tools.copyAsPrompt.aiPrompt.label'),
      description: t('shared.settings.tools.copyAsPrompt.aiPrompt.description'),
      defaultValue: '#{content}'
    }
  }) as const satisfies SettingConfigItem<'textarea'>

export const createConvertLanguagePairsConfig = (t: TFunction) =>
  ({
    key: 'convertLanguagePairs',
    saveType: 'workspace',
    renderOptions: {
      type: 'jsonEditor',
      label: t('shared.settings.tools.codeConvert.convertLanguagePairs.label'),
      description: t(
        'shared.settings.tools.codeConvert.convertLanguagePairs.description'
      ),
      defaultValue: ''
    }
  }) as const satisfies SettingConfigItem<'jsonEditor'>

export const createAutoRememberConvertLanguagePairsConfig = (t: TFunction) =>
  ({
    key: 'autoRememberConvertLanguagePairs',
    saveType: 'global',
    renderOptions: {
      type: 'switch',
      label: t(
        'shared.settings.tools.codeConvert.autoRememberConvertLanguagePairs.label'
      ),
      description: t(
        'shared.settings.tools.codeConvert.autoRememberConvertLanguagePairs.description'
      ),
      defaultValue: false
    }
  }) as const satisfies SettingConfigItem<'switch'>

export const createCodeViewerHelperPromptConfig = (t: TFunction) =>
  ({
    key: 'codeViewerHelperPrompt',
    saveType: 'global',
    renderOptions: {
      type: 'textarea',
      label: t('shared.settings.tools.codeViewerHelper.prompt.label'),
      description: t(
        'shared.settings.tools.codeViewerHelper.prompt.description'
      ),
      defaultValue:
        'You are a programming language commentator.\nYou need to help me add comments to #{sourceLanguage} code as much as possible to make it readable for beginners.\nDo not change the original code, just add as detailed comments as possible,\nbecause my purpose is only to understand and read. Please use my native language #{locale} as the commenting language.\nPlease do not reply with any text other than the code, and do not use markdown syntax.\nHere is the code you need to comment on:\n\n#{content}'
    }
  }) as const satisfies SettingConfigItem<'textarea'>

export const createExpertCodeEnhancerPromptListConfig = (t: TFunction) =>
  ({
    key: 'expertCodeEnhancerPromptList',
    saveType: 'global',
    renderOptions: {
      type: 'jsonEditor',
      label: t('shared.settings.tools.expertCodeEnhancer.promptList.label'),
      description: t(
        'shared.settings.tools.expertCodeEnhancer.promptList.description'
      ),
      defaultValue: ''
    }
  }) as const satisfies SettingConfigItem<'jsonEditor'>

export const createReadClipboardImageConfig = (t: TFunction) =>
  ({
    key: 'readClipboardImage',
    saveType: 'global',
    renderOptions: {
      type: 'switch',
      label: t('shared.settings.tools.smartPaste.readClipboardImage.label'),
      description: t(
        'shared.settings.tools.smartPaste.readClipboardImage.description'
      ),
      defaultValue: false
    }
  }) as const satisfies SettingConfigItem<'switch'>

export const createDefaultModelConfig = (t: TFunction) =>
  ({
    key: 'defaultModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label: createModelSettingKeyTitleMap(t)[FeatureModelSettingKey.Default],
      featureModelSettingKey: FeatureModelSettingKey.Default,
      description: t('shared.settings.chat.defaultModel.description'),
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createChatModelConfig = (t: TFunction) =>
  ({
    key: 'chatModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label: createModelSettingKeyTitleMap(t)[FeatureModelSettingKey.Chat],
      featureModelSettingKey: FeatureModelSettingKey.Chat,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createComposerModelConfig = (t: TFunction) =>
  ({
    key: 'composerModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label: createModelSettingKeyTitleMap(t)[FeatureModelSettingKey.Composer],
      featureModelSettingKey: FeatureModelSettingKey.Composer,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createV1ModelConfig = (t: TFunction) =>
  ({
    key: 'v1Model',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label: createModelSettingKeyTitleMap(t)[FeatureModelSettingKey.V1],
      featureModelSettingKey: FeatureModelSettingKey.V1,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createAgentModelConfig = (t: TFunction) =>
  ({
    key: 'agentModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label: createModelSettingKeyTitleMap(t)[FeatureModelSettingKey.Agent],
      featureModelSettingKey: FeatureModelSettingKey.Agent,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createCompletionModelConfig = (t: TFunction) =>
  ({
    key: 'completionModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label:
        createModelSettingKeyTitleMap(t)[FeatureModelSettingKey.Completion],
      featureModelSettingKey: FeatureModelSettingKey.Completion,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createApplyFileModelConfig = (t: TFunction) =>
  ({
    key: 'applyFileModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label: createModelSettingKeyTitleMap(t)[FeatureModelSettingKey.ApplyFile],
      featureModelSettingKey: FeatureModelSettingKey.ApplyFile,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createBatchProcessorModelConfig = (t: TFunction) =>
  ({
    key: 'batchProcessorModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label:
        createModelSettingKeyTitleMap(t)[FeatureModelSettingKey.BatchProcessor],
      featureModelSettingKey: FeatureModelSettingKey.BatchProcessor,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createCodeConvertModelConfig = (t: TFunction) =>
  ({
    key: 'codeConvertModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label:
        createModelSettingKeyTitleMap(t)[FeatureModelSettingKey.CodeConvert],
      featureModelSettingKey: FeatureModelSettingKey.CodeConvert,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createCodeViewerHelperModelConfig = (t: TFunction) =>
  ({
    key: 'codeViewerHelperModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label:
        createModelSettingKeyTitleMap(t)[
          FeatureModelSettingKey.CodeViewerHelper
        ],
      featureModelSettingKey: FeatureModelSettingKey.CodeViewerHelper,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createExpertCodeEnhancerModelConfig = (t: TFunction) =>
  ({
    key: 'expertCodeEnhancerModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label:
        createModelSettingKeyTitleMap(t)[
          FeatureModelSettingKey.ExpertCodeEnhancer
        ],
      featureModelSettingKey: FeatureModelSettingKey.ExpertCodeEnhancer,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createRenameVariableModelConfig = (t: TFunction) =>
  ({
    key: 'renameVariableModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label:
        createModelSettingKeyTitleMap(t)[FeatureModelSettingKey.RenameVariable],
      featureModelSettingKey: FeatureModelSettingKey.RenameVariable,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createSmartPasteModelConfig = (t: TFunction) =>
  ({
    key: 'smartPasteModel',
    saveType: 'global',
    renderOptions: {
      type: 'modelSelector',
      label:
        createModelSettingKeyTitleMap(t)[FeatureModelSettingKey.SmartPaste],
      featureModelSettingKey: FeatureModelSettingKey.SmartPaste,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'modelSelector'>

export const createAboutConfig = (t: TFunction) =>
  ({
    key: 'about',
    saveType: 'global',
    renderOptions: {
      type: 'about',
      label: t('shared.settings.about.label'),
      hideLabel: true,
      description: '',
      defaultValue: {}
    }
  }) as const satisfies SettingConfigItem<'about'>
