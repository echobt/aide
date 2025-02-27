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
      'We currently only support viewing the usage information of the Aide model aggregation service. Please check: [https://aide.nicepkg.cn/guide/use-another-llm/aide-models](https://aide.nicepkg.cn/guide/use-another-llm/aide-models)',
    agentServerUtilsProvidersNotFound: 'AgentServerUtilsProviders not found',
    agentNameNotFound: 'Agent name not found',
    agentServerUtilsProviderNotFound:
      'AgentServerUtilsProvider not found for {{agentName}}',
    chatContextNotFound: 'Chat context not found',
    conversationNotFound: 'Conversation not found',
    actionNotFound: 'Action not found',
    serverUtilsProvidersNotFound: 'ServerUtilsProviders not found'
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
  },
  agentActions: {
    agentServerUtilsProvidersNotFound: 'AgentServerUtilsProviders not found',
    agentNameNotFound: 'Agent name not found',
    agentServerUtilsProviderNotFound:
      'AgentServerUtilsProvider not found for {{agentName}}',
    chatContextNotFound: 'Chat context not found',
    conversationNotFound: 'Conversation not found',
    actionNotFound: 'Action not found',
    serverUtilsProvidersNotFound: 'ServerUtilsProviders not found',
    checkpoint: 'Checkpoint'
  },
  applyActions: {
    codeEditProviderNotFound: 'CodeEditProvider not found',
    invalidSchemeUriParameter: 'Invalid schemeUri parameter',
    newFileDoesNotNeedAiStream: 'New file does not need AI stream'
  },
  chatSessionActions: {
    sessionNotFound: 'Session not found'
  },
  codebaseActions: {
    codebaseWatcherNotFound: 'Codebase watcher not found',
    indexerNotFound: 'Indexer not found'
  },
  gitProject: {
    validation: {
      nameRequired: 'Project name is required',
      nameNoSlashes: 'Project name cannot contain slashes or backslashes',
      nameUnique: 'Project name must be unique',
      invalidRepoUrl: 'Invalid repository URL'
    },
    errors: {
      projectNotFound: 'Project not found'
    }
  },
  doc: {
    validation: {
      siteNameRequired: 'Site name is required',
      invalidUrl: 'Invalid URL'
    },
    errors: {
      siteNotFound: 'can not find doc site',
      crawlFirst: 'please crawl the site first'
    }
  },
  mcp: {
    validation: {
      nameRequired: 'Name is required',
      nameUnique: 'Name must be unique'
    },
    errors: {
      nameInUse: 'Name is already in use',
      configNotFound: 'Endpoint not found',
      connectionNotInitialized: 'Mcp connection {{id}} not initialized',
      unsupportedTransportType: 'Unsupported transport type: {{type}}'
    }
  },
  mention: {
    errors: {
      providersNotFound: 'MentionServerUtilsProviders not found',
      actionRegisterNotFound: 'ActionRegister not found'
    }
  },
  project: {
    validation: {
      nameRequired: 'Project name is required',
      nameNoSlashes: 'Project name cannot contain slashes or backslashes',
      nameUnique: 'Project name must be unique',
      pathRequired: 'Project path is required'
    }
  },
  promptSnippet: {
    validation: {
      titleRequired: 'Title is required',
      titleUnique: 'Title must be unique'
    },
    errors: {
      snippetNotFound: 'Snippet with id {{id}} not found'
    }
  },
  settings: {
    webview: {
      title: 'Aide Settings'
    },
    errors: {
      webviewProviderNotFound: 'Webview provider not found',
      invalidGitPath: 'Invalid git executable path'
    }
  },
  system: {
    errors: {
      webviewProviderNotFound: 'Webview provider not found'
    }
  },
  webvm: {
    validation: {
      presetNameRequired: 'Preset name is required',
      frameworkNameRequired: 'Framework name is required',
      projectNameRequired: 'Project name is required',
      sessionIdRequired: 'Session ID is required',
      filePathRequired: 'File path is required'
    },
    errors: {
      webviewProviderNotFound: 'Webview provider not found',
      webvmRegisterNotFound: 'WebVM register not found',
      presetNotFound: 'Preset {{presetName}} not found',
      invalidWebvmUri: 'Invalid webvm URI: scheme is not webvm',
      noFreePorts: 'No free ports found'
    },
    webview: {
      title: 'V1 Preview'
    },
    projectManager: {
      initUsingPreset: '[Init] Using preset: {{presetName}}'
    },
    orchestrator: {
      errors: {
        initProjectFailed: 'Failed to initialize project'
      },
      cleanup: '[Cleanup] Dev server stopped'
    }
  },
  workspaceCheckpoint: {
    errors: {
      notInitialized: 'WorkspaceCheckpoint not initialized',
      restrictedDirectory:
        'Cannot create checkpoints in {{directory}} directory',
      directoryNotExist: 'Working directory does not exist: {{directory}}',
      createFailed: 'Failed to create checkpoint:',
      restoreFailed: 'Failed to restore checkpoint:',
      writeFileFailed: 'Failed to write file to memfs: {{relativePath}}',
      operationFailed: 'Operation failed, attempting recovery:',
      recoveryFailed: 'Recovery failed:',
      operationAndRecoveryFailed:
        'Operation failed and could not be recovered: {{error}}',
      disposeFailed: 'Failed to dispose checkpoint:'
    },
    git: {
      errors: {
        noCommitsNoFiles: 'No commits found and no files to commit'
      }
    }
  },
  embeddings: {
    errors: {
      noActiveModel: 'No active embedding model set',
      pipelineNotInitialized: 'Pipeline not initialized',
      embeddingError: 'Error during embedding: {{message}}'
    },
    info: {
      localProviderInitialized: 'Local embedding provider initialized'
    }
  },
  modelProviders: {
    errors: {
      modelNameRequired:
        'Model name is required, Please check your AI model settings',
      providerNotFound: 'Provider not found: {{providerId}}',
      modelNotFound: 'Model not found: {{modelName}}',
      unsupportedProviderType: 'Unsupported provider type: {{type}}',
      missingProviderOrModel:
        'You forgot to set provider or model in your settings, please check your settings.'
    }
  },
  chat: {
    baseNode: {
      missingProperties: 'Agent context is missing required properties',
      strategyProviderNotFound: 'Chat strategy provider not found'
    },
    chatStrategy: {
      providerNotFound: 'Chat strategy provider not found'
    },
    composerStrategy: {
      providerNotFound: 'Composer strategy provider not found'
    },
    noPromptStrategy: {
      providerNotFound: 'NoPrompt strategy provider not found'
    },
    v1Strategy: {
      chatProviderNotFound: 'Chat strategy provider not found'
    },
    docCrawler: {
      pageNotFound: 'Page not found: {{url}}',
      httpError: 'HTTP error! status: {{status}}',
      timeoutFetching: 'Timeout while fetching {{url}}',
      failedToGetContent: 'Failed to get content for {{pageUrl}}:',
      pageContentTooLarge: 'Page content too large',
      extractedContentTooSmall: 'Extracted content too small',
      failedToProcessPage: 'Failed to process page {{pageUrl}}: {{error}}',
      tooLarge: 'too large',
      tooSmall: 'too small',
      skippingDueTo: 'Skipping {{pageUrl}} due to: {{error}}',
      maxRetriesExceeded: 'Max retries exceeded for {{pageUrl}}',
      errorCrawling: 'Error crawling {{pageUrl}}:'
    },
    codeSnippet: {
      startLineGreaterThanEndLine: 'startLine cannot be greater than endLine'
    },
    conversation: {
      serverUtilsProvidersNotFound: 'ServerUtilsProviders not found'
    }
  },
  // VFS related translations
  vfs: {
    errors: {
      noHandlerFound: 'No handler found for URI: {{uri}}'
    },
    workspace: {
      errors: {
        noPathProvided: 'No relative path or full path provided'
      }
    },
    webvm: {
      errors: {
        missingProjectId: 'Invalid webvm URI: missing project id',
        missingPresetName: 'Invalid webvm URI: missing preset name',
        notImplemented: 'Not implemented'
      }
    },
    project: {
      errors: {
        projectNotFound: 'Project: {{name}} not found',
        missingProjectName: 'Invalid project URI: missing project name',
        notImplemented: 'Not implemented'
      }
    },
    gitProject: {
      errors: {
        missingType: 'Invalid git project URI: missing type',
        missingProjectName: 'Invalid git project URI: missing project name',
        notImplemented: 'Not implemented'
      }
    },
    doc: {
      errors: {
        siteNotFound: 'Site: {{siteName}} not found',
        missingSiteName: 'Invalid doc URI: missing site name',
        notImplemented: 'Not implemented'
      }
    },
    ensureDir: {
      errors: {
        invalidCharacters: 'Path contains invalid characters: {{path}}'
      }
    }
  },

  // Temp file related translations
  tmpFile: {
    errors: {
      missingLanguageIdOrTmpFileUri:
        "createTmpFileAndWriter: Either 'languageId' or 'tmpFileUri' must be provided."
    }
  },

  // Commands related translations
  commands: {
    openWebview: {
      errors: {
        providerNotFound: 'WebviewProvider not found'
      }
    },
    action: {
      errors: {
        registerNotFound: 'ActionRegister not found'
      }
    }
  },

  // Git related translations
  git: {
    errors: {
      executableNotFound:
        'Git executable not found. Please install git or set custom path in settings.'
    }
  },

  // State related translations
  state: {
    registerManagerNotSet: 'RegisterManager is not set',
    actionRegisterNotSet: 'ActionRegister is not set'
  },

  // AI Provider related translations
  aiProvider: {
    providerOrBaseUrlRequired: 'Provider or base URL is required'
  },

  // Paths related translations
  paths: {
    errors: {
      noContext: 'No context found'
    }
  },

  // TraverseFS related translations
  traverseFs: {
    errors: {
      emptySchemeUris: 'schemeUris is empty'
    }
  },

  // Webview related translations
  webview: {
    errors: {
      actionRegisterNotFound: 'ActionRegister not found'
    }
  },

  // Code Edit related translations
  codeEdit: {
    errors: {
      taskNotFound: 'Task not found'
    }
  },

  serverPlugin: {
    vscode: {
      internalToolMessage: "Aide extension internal tool, Don't use it.",
      internalToolTitle: 'Aide extension internal tool',
      internalToolConfirmMessage:
        "Aide extension internal tool, Don't use it in."
    }
  }
}
