import {
  FeatureModelSettingKey,
  modelSettingKeyTitleMap
} from '../ai-provider-entity'
import type { SettingConfigItem } from './types'

// General settings
export const apiConcurrencyConfig = {
  key: 'apiConcurrency',
  saveType: 'global',
  renderOptions: {
    type: 'numberInput',
    label: 'API Concurrency',
    description: 'API request concurrency, click to view online documentation',
    defaultValue: 3
  }
} as const satisfies SettingConfigItem<'numberInput'>

export const rulesForAIConfig = {
  key: 'rulesForAI',
  saveType: 'global',
  renderOptions: {
    type: 'textarea',
    label: 'Rules for AI',
    description: 'These rules get shown to the AI on all chats.',
    placeholder:
      'e.g., "always use functional React, never use unwrap in rust, always output your answers in Portuguese";',
    defaultValue: ''
  }
} as const satisfies SettingConfigItem<'textarea'>

export const useSystemProxyConfig = {
  key: 'useSystemProxy',
  saveType: 'global',
  renderOptions: {
    type: 'switch',
    label: 'Use System Proxy',
    description:
      'Use global proxy (HTTP_PROXY, HTTPS_PROXY, ALL_PROXY), you need to restart VSCode to take effect after changing this setting',
    defaultValue: false
  }
} as const satisfies SettingConfigItem<'switch'>

export const additionalGitIgnoreConfig = {
  key: 'additionalGitIgnore',
  saveType: 'workspace',
  renderOptions: {
    type: 'textarea',
    label: 'Additional .gitignore Rules',
    description:
      'Additional .gitignore rules to be combined with existing .gitignore file',
    placeholder:
      'e.g.:\n# Node\nnode_modules/\n\n# Python\n__pycache__/\n*.pyc\n\n# Build\ndist/\nbuild/',
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
} as const satisfies SettingConfigItem<'textarea'>

export const respectGitIgnoreConfig = {
  key: 'respectGitIgnore',
  saveType: 'workspace',
  renderOptions: {
    type: 'switch',
    label: 'Respect .gitignore',
    description: 'Respect .gitignore file',
    defaultValue: true
  }
} as const satisfies SettingConfigItem<'switch'>

export const codebaseIndexingConfig = {
  key: 'codebaseIndexing',
  saveType: 'workspace',
  renderOptions: {
    type: 'codebaseIndexing',
    label: 'Codebase Indexing',
    description:
      'Uses Tree-sitter to parse and split code into semantic chunks, then creates vector embeddings in a database. This enables AI to efficiently search and understand your codebase context.',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'codebaseIndexing'>

export const mcpManagementConfig = {
  key: 'mcpManagement',
  saveType: 'global',
  renderOptions: {
    type: 'mcpManagement',
    label: 'MCP Endpoints',
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'mcpManagement'>

// Chat settings
export const modelsConfig = {
  key: 'models',
  saveType: 'global',
  renderOptions: {
    type: 'modelManagement',
    label: 'Models',
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelManagement'>

export const docManagementConfig = {
  key: 'docManagement',
  saveType: 'global',
  renderOptions: {
    type: 'docManagement',
    label: 'Doc Sites Indexing',
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'docManagement'>

export const promptSnippetConfig = {
  key: 'promptSnippet',
  saveType: 'global',
  renderOptions: {
    type: 'promptSnippetManagement',
    label: 'Prompt Snippets',
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'promptSnippetManagement'>

export const projectManagementConfig = {
  key: 'projectManagement',
  saveType: 'global',
  renderOptions: {
    type: 'projectManagement',
    label: 'Project Management',
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'projectManagement'>

export const gitExecutablePathConfig = {
  key: 'gitExecutablePath',
  saveType: 'global',
  renderOptions: {
    type: 'input',
    label: 'Git Executable Path',
    description:
      'Custom git executable path. Leave empty to auto detect. If it is not set, it will use the system git path.',
    placeholder: 'e.g., /usr/bin/git or C:\\Program Files\\Git\\bin\\git.exe',
    defaultValue: ''
  }
} as const satisfies SettingConfigItem<'input'>

export const gitProjectManagementConfig = {
  key: 'gitProjectManagement',
  saveType: 'global',
  renderOptions: {
    type: 'gitProjectManagement',
    label: 'Git Project Management',
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'gitProjectManagement'>

// Tool settings
export const aiPromptConfig = {
  key: 'aiPrompt',
  saveType: 'global',
  renderOptions: {
    type: 'textarea',
    label: 'AI Prompt Template',
    description:
      'Template for copied content, use #{content} as a variable for file content',
    defaultValue: '#{content}'
  }
} as const satisfies SettingConfigItem<'textarea'>

export const convertLanguagePairsConfig = {
  key: 'convertLanguagePairs',
  saveType: 'workspace',
  renderOptions: {
    type: 'jsonEditor',
    label: 'Convert Language Pairs',
    description: 'Default convert language pairs',
    defaultValue: ''
  }
} as const satisfies SettingConfigItem<'jsonEditor'>

export const autoRememberConvertLanguagePairsConfig = {
  key: 'autoRememberConvertLanguagePairs',
  saveType: 'global',
  renderOptions: {
    type: 'switch',
    label: 'Auto Remember Convert Language Pairs',
    description: 'Automatically remember convert language pairs',
    defaultValue: false
  }
} as const satisfies SettingConfigItem<'switch'>

export const codeViewerHelperPromptConfig = {
  key: 'codeViewerHelperPrompt',
  saveType: 'global',
  renderOptions: {
    type: 'textarea',
    label: 'Code Viewer Helper Prompt',
    description: 'Code viewer helper AI prompt template',
    defaultValue:
      'You are a programming language commentator.\nYou need to help me add comments to #{sourceLanguage} code as much as possible to make it readable for beginners.\nDo not change the original code, just add as detailed comments as possible,\nbecause my purpose is only to understand and read. Please use my native language #{locale} as the commenting language.\nPlease do not reply with any text other than the code, and do not use markdown syntax.\nHere is the code you need to comment on:\n\n#{content}'
  }
} as const satisfies SettingConfigItem<'textarea'>

export const expertCodeEnhancerPromptListConfig = {
  key: 'expertCodeEnhancerPromptList',
  saveType: 'global',
  renderOptions: {
    type: 'jsonEditor',
    label: 'Expert Code Enhancer Prompt List',
    description: 'Expert code enhancer AI prompt template list',
    defaultValue: ''
  }
} as const satisfies SettingConfigItem<'jsonEditor'>

export const readClipboardImageConfig = {
  key: 'readClipboardImage',
  saveType: 'global',
  renderOptions: {
    type: 'switch',
    label: 'Read Clipboard Image',
    description:
      'Allow reading clipboard images as AI context in certain scenarios',
    defaultValue: false
  }
} as const satisfies SettingConfigItem<'switch'>

export const defaultModelConfig = {
  key: 'defaultModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.Default],
    featureModelSettingKey: FeatureModelSettingKey.Default,
    description: 'If no specific model is selected, this model will be used',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const chatModelConfig = {
  key: 'chatModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.Chat],
    featureModelSettingKey: FeatureModelSettingKey.Chat,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const composerModelConfig = {
  key: 'composerModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.Composer],
    featureModelSettingKey: FeatureModelSettingKey.Composer,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const v1ModelConfig = {
  key: 'v1Model',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.V1],
    featureModelSettingKey: FeatureModelSettingKey.V1,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const agentModelConfig = {
  key: 'agentModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.Agent],
    featureModelSettingKey: FeatureModelSettingKey.Agent,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const completionModelConfig = {
  key: 'completionModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.Completion],
    featureModelSettingKey: FeatureModelSettingKey.Completion,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const applyFileModelConfig = {
  key: 'applyFileModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.ApplyFile],
    featureModelSettingKey: FeatureModelSettingKey.ApplyFile,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const batchProcessorModelConfig = {
  key: 'batchProcessorModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.BatchProcessor],
    featureModelSettingKey: FeatureModelSettingKey.BatchProcessor,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const codeConvertModelConfig = {
  key: 'codeConvertModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.CodeConvert],
    featureModelSettingKey: FeatureModelSettingKey.CodeConvert,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const codeViewerHelperModelConfig = {
  key: 'codeViewerHelperModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.CodeViewerHelper],
    featureModelSettingKey: FeatureModelSettingKey.CodeViewerHelper,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const expertCodeEnhancerModelConfig = {
  key: 'expertCodeEnhancerModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.ExpertCodeEnhancer],
    featureModelSettingKey: FeatureModelSettingKey.ExpertCodeEnhancer,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const renameVariableModelConfig = {
  key: 'renameVariableModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.RenameVariable],
    featureModelSettingKey: FeatureModelSettingKey.RenameVariable,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const smartPasteModelConfig = {
  key: 'smartPasteModel',
  saveType: 'global',
  renderOptions: {
    type: 'modelSelector',
    label: modelSettingKeyTitleMap[FeatureModelSettingKey.SmartPaste],
    featureModelSettingKey: FeatureModelSettingKey.SmartPaste,
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'modelSelector'>

export const aboutConfig = {
  key: 'about',
  saveType: 'global',
  renderOptions: {
    type: 'about',
    label: 'About',
    description: '',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'about'>
