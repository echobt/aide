// English translations for extension
export default {
  command: {
    copyAsPrompt: '✨ Aide: Copy As AI Prompt',
    codeConvert: '✨ Aide: Code Convert',
    codeViewerHelper: '✨ Aide: Code Viewer Helper',
    expertCodeEnhancer: '✨ Aide: Expert Code Enhancer',
    renameVariable: '✨ Aide: Rename Variable',
    smartPaste: '✨ Aide: Smart Paste',
    batchProcessor: '✨ Aide: AI Batch Processor',
    openWebview: '✨ Aide: Open Webview',
    copyFileText: 'Copy text',
    quickCloseFileWithoutSave: 'Quick close',
    replaceFile: 'Replace original',
    showDiff: 'Compare original',
    action: 'Execute Action',
    inlineDiff: {
      accept: 'Accept',
      reject: 'Reject',
      acceptAll: 'Accept All',
      rejectAll: 'Reject All',
      showError: 'Show Error'
    },
    chatHistoriesTree: {
      refresh: 'Refresh Chat Histories',
      createAndOpenSession: 'Create and Open Chat',
      deleteSession: 'Delete Chat',
      duplicateSession: 'Duplicate Chat'
    },
    promptSnippetTree: {
      refresh: 'Refresh Prompt Snippets',
      createSnippet: 'Create Prompt Snippet',
      deleteSnippet: 'Delete Prompt Snippet',
      duplicateSnippet: 'Duplicate Prompt Snippet'
    }
  },
  view: {
    chatHistoriesTree: 'Aide Chat Histories',
    promptSnippetTree: 'Aide Prompt Snippets'
  },
  config: {
    title: 'Aide Configuration',
    apiConcurrency: {
      description:
        'API request concurrency, [click to view online documentation](https://aide.nicepkg.cn/guide/configuration/api-concurrency)'
    },
    useSystemProxy: {
      description:
        'Use global proxy (`HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`), you need to restart `VSCode` to take effect after changing this setting, [click to view online documentation](https://aide.nicepkg.cn/guide/configuration/use-system-proxy)'
    },
    codeViewerHelperPrompt: {
      description:
        'Code viewer helper AI prompt template, [click to view online documentation](https://aide.nicepkg.cn/guide/configuration/code-viewer-helper-prompt)'
    },
    expertCodeEnhancerPromptList: {
      description:
        'Expert code enhancer AI prompt template list, [click to view online documentation](https://aide.nicepkg.cn/guide/configuration/expert-code-enhancer-prompt-list)',
      solid: 'Optimize using SOLID principles',
      dry: 'Optimize using DRY principles',
      designPatterns: 'Apply appropriate design patterns',
      splitComponents: 'Split into smaller components',
      cleanliness: 'Improve code cleanliness',
      performance: 'Optimize for performance',
      databaseQueries: 'Optimize database queries',
      security: 'Enhance security measures',
      concurrency: 'Optimize concurrency and multithreading',
      optimizeConditionals: 'if-else cleaning master'
    },
    convertLanguagePairs: {
      description:
        'Default convert language pairs, [click to view online documentation](https://aide.nicepkg.cn/guide/configuration/convert-language-pairs)'
    },
    autoRememberConvertLanguagePairs: {
      description:
        'Automatically remember convert language pairs, [click to view online documentation](https://aide.nicepkg.cn/guide/configuration/auto-remember-convert-language-pairs)'
    },
    readClipboardImage: {
      description:
        'Allow reading clipboard images as AI context in certain scenarios, [click to view online documentation](https://aide.nicepkg.cn/guide/configuration/read-clipboard-image)'
    },
    aiPrompt: {
      description:
        'Template for copied content, use `#{content}` as a variable for file content, [click to view online documentation](https://aide.nicepkg.cn/guide/configuration/ai-prompt)'
    },
    ignorePatterns: {
      description:
        'Ignored file name patterns, supports `glob` syntax, [click to view online documentation](https://aide.nicepkg.cn/guide/configuration/ignore-patterns)'
    },
    respectGitIgnore: {
      description:
        'Respect `.gitignore` file, [click to view online documentation](https://aide.nicepkg.cn/guide/configuration/respect-git-ignore)'
    }
  },
  input: {
    codeConvertTargetLanguage: {
      prompt: 'Select convert target language'
    },
    batchProcessor: {
      prompt:
        'Let AI batch process your selected {{filesCount}} files, what do you want AI to do?',
      placeholder: 'eg: help me migrate from python2 to python3'
    },
    selectAiSuggestionsVariableName: {
      prompt: 'Select AI suggestions variable name'
    },
    expertCodeEnhancer: {
      selectPrompt: {
        title: 'Select code optimize method'
      },
      customPrompt: {
        placeholder: 'Custom optimize prompt'
      }
    }
  },
  error: {
    noWorkspace: 'Unable to determine workspace folder',
    invalidConfigKey: 'Invalid configuration key',
    invalidConfigValueType: 'Invalid configuration value type',
    invalidConfigValueOption: 'Invalid configuration value option',
    failedToUpdateConfig: 'Failed to update configuration',
    invalidJson: 'Invalid JSON format',
    invalidNumber: 'Invalid number',
    invalidBaseUrl: 'Invalid Base URL',
    invalidAzureOpenaiBaseUrl: 'Invalid Azure OpenAI Base URL',
    vscodeLLMModelNotFound:
      'VSCode LLM model not found, please check configuration',
    noSelection: 'No file or folder selected',
    noActiveEditor: 'Please open any file first to determine workspace',
    noTargetLanguage: 'No target language selected',
    noContext: 'Context not initialized',
    emptyClipboard: 'Clipboard is empty',
    xclipNotFound:
      'xclip is not installed. Please install it using your package manager (e.g., sudo apt-get install xclip)',
    fileNotFound: 'File not found',
    invalidInput: 'Invalid input',
    aideKeyUsageInfoOnlySupportAideModels:
      'We currently only support viewing the usage information of the Aide model aggregation service. Please check: [https://aide.nicepkg.cn/guide/use-another-llm/aide-models](https://aide.nicepkg.cn/guide/use-another-llm/aide-models)'
  },
  info: {
    copied: 'File contents have been copied to clipboard',
    noAiSuggestionsVariableName: 'AI thinks your variable name is already good',
    processing: 'Aide is processing...',
    continueMessage:
      "Continue? I'm not sure if it's done yet, if there's still content not generated, you can click continue.",
    iconContinueMessage:
      '(You can also click the original generate icon to continue)',
    continue: 'Continue',
    cancel: 'Cancel',
    commandCopiedToClipboard: 'AI command has been copied to clipboard',
    fileReplaceSuccess: 'File content has been replaced successfully',
    batchProcessorSuccess:
      'AI batch processor success!\n\nTotal {{filesCount}} files generated, you can review and replace manually.\n\nTasks completed:\n{{tasks}}',
    loading: 'Loading...'
  },
  file: {
    content: 'File: {{filePath}}\n```{{fileLanguage}}\n{{fileContent}}\n```\n\n'
  }
}
