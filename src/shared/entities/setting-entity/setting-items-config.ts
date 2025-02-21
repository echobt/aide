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
    type: 'objectInput',
    label: 'Convert Language Pairs',
    description: 'Default convert language pairs',
    defaultValue: {}
  }
} as const satisfies SettingConfigItem<'objectInput'>

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
    type: 'arrayInput',
    label: 'Expert Code Enhancer Prompt List',
    description: 'Expert code enhancer AI prompt template list',
    defaultValue: []
  }
} as const satisfies SettingConfigItem<'arrayInput'>

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
