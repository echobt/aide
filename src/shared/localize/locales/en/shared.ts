export default {
  aiProvider: {
    name: {
      custom: 'Custom',
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      aide: 'Aide',
      azureOpenai: 'Azure OpenAI',
      vscodelm: 'VSCodeLM',
      unknown: ''
    },
    fields: {
      label: {
        customApiBaseUrl: 'Custom Third-Party Base URL',
        customApiKey: 'Custom Third-Party API Key',
        openaiApiBaseUrl: 'OpenAI Base URL',
        openaiApiKey: 'OpenAI API Key',
        anthropicApiUrl: 'Anthropic Base URL',
        anthropicApiKey: 'Anthropic API Key',
        aideApiBaseUrl: 'Aide Base URL',
        aideApiKey: 'Aide API Key',
        azureOpenaiBasePath: 'Azure OpenAI Base Path',
        azureOpenaiApiKey: 'Azure OpenAI API Key',
        azureOpenaiApiVersion: 'Azure OpenAI API Version',
        azureOpenaiApiDeploymentName: 'Azure OpenAI Deployment Name',
        vscodeLmVendor: 'VSCodeLM Vendor'
      }
    },
    featureModelSetting: {
      default: 'Default Model',
      chat: 'Chat Model',
      composer: 'Composer Model',
      v1: 'V1 Model',
      agent: 'Agent Model',
      noPrompt: 'No Prompt Model',
      completion: 'Completion Model',
      applyFile: 'Apply File Model',
      batchProcessor: 'Batch Processor Model',
      codeConvert: 'Code Convert Model',
      codeViewerHelper: 'Code Viewer Helper Model',
      expertCodeEnhancer: 'Expert Code Enhancer Model',
      renameVariable: 'Rename Variable Model',
      smartPaste: 'Smart Paste Model'
    }
  },
  entities: {
    chatContext: {
      defaultTitle: 'New Chat'
    },
    chatSession: {
      defaultTitle: 'New Chat'
    },
    mcp: {
      validation: {
        nameRequired: 'Name is required',
        commandRequired: 'Command is required',
        invalidWebSocketUrl: 'Invalid WebSocket URL',
        invalidSseUrl: 'Invalid SSE URL'
      }
    }
  },
  plugins: {
    agents: {
      codebaseSearch: {
        title: 'Search Codebase'
      },
      docRetriever: {
        title: 'Search documentation'
      },
      editFile: {
        actions: {
          apply: 'Apply',
          reject: 'Reject',
          accept: 'Accept',
          reapply: 'Reapply',
          copy: 'Copy',
          copyCode: 'Copy code'
        },
        status: {
          generating: 'Generating',
          reviewing: 'Reviewing',
          accepted: 'Accepted',
          rejected: 'Rejected'
        },
        messages: {
          codeCopied: 'Code copied to clipboard'
        },
        errors: {
          codeEditTaskNotFound: 'Code edit task not found',
          failedToApplyCode: 'Failed to apply code: {{error}}'
        },
        logs: {
          failedToApplyCode: 'Failed to apply code'
        }
      },
      mcpTool: {
        title: 'MCP Tools',
        preview: {
          input: 'input',
          output: 'output'
        }
      },
      readFiles: {
        title: 'Read Files'
      },
      webSearch: {
        title: 'Search web'
      },
      webVisit: {
        title: 'Visit web'
      }
    },
    mentions: {
      doc: {
        docs: 'Docs',
        docsSetting: 'Docs setting'
      },
      fs: {
        files: 'Files',
        folders: 'Folders',
        tree: 'Tree',
        codebase: 'Codebase',
        errors: 'Errors',
        localProjects: 'Local Projects',
        gitProjects: 'Git Projects',
        localProjectsSetting: 'Local Projects setting',
        gitProjectsSetting: 'Git Projects setting'
      },
      git: {
        git: 'Git',
        diffWorkingState: 'Diff (Diff of Working State)',
        prDiffWithMainBranch: 'PR (Diff with Main Branch)'
      },
      mcp: {
        description: 'Description',
        parameters: 'Parameters',
        mcpSetting: 'MCP Setting',
        mcpEndpoints: 'MCP Endpoints'
      },
      promptSnippet: {
        promptSnippets: 'Prompt Snippets',
        promptSnippetSetting: 'Prompt Snippets Setting',
        noCommands: 'No commands'
      },
      terminal: {
        terminals: 'Terminals',
        noCommandHistory: 'No command history',
        exitCode: 'Exit'
      },
      web: {
        web: 'Web'
      }
    }
  },
  settings: {
    general: {
      label: 'General',
      language: {
        label: 'Language',
        description: 'Select the language for the extension'
      },
      theme: {
        label: 'Theme',
        description: 'Select the theme for the extension'
      },
      rulesForAI: {
        label: 'Rules for AI',
        description: 'These rules get shown to the AI on all chats.',
        placeholder:
          'e.g., "always use functional React, never use unwrap in rust, always output your answers in Portuguese";'
      },
      respectGitIgnore: {
        label: 'Respect .gitignore',
        description: 'Respect .gitignore file'
      },
      additionalGitIgnore: {
        label: 'Additional .gitignore Rules',
        description:
          'Additional .gitignore rules to be combined with existing .gitignore file',
        placeholder:
          'e.g.:\n# Node\nnode_modules/\n\n# Python\n__pycache__/\n*.pyc\n\n# Build\ndist/\nbuild/'
      },
      useSystemProxy: {
        label: 'Use System Proxy',
        description:
          'Use global proxy (HTTP_PROXY, HTTPS_PROXY, ALL_PROXY), you need to restart VSCode to take effect after changing this setting'
      }
    },
    about: {
      label: 'About'
    },
    chat: {
      label: 'Chat',
      defaultModel: {
        description: 'If no specific model is selected, this model will be used'
      },
      chatModel: {
        label: 'AI Models'
      },
      codebaseIndexing: {
        label: 'Codebase Indexing',
        description:
          'Uses Tree-sitter to parse and split code into semantic chunks, then creates vector embeddings in a database. This enables AI to efficiently search and understand your codebase context.'
      },
      mcpManagement: {
        label: 'MCP Management'
      },
      chatDoc: {
        label: 'Doc Sites Indexing'
      },
      promptSnippets: {
        label: 'Prompt Snippets'
      },
      projectManagement: {
        label: 'Local Projects'
      },
      gitProjectManagement: {
        label: 'Git Projects'
      },
      gitExecutablePath: {
        label: 'Git Executable Path',
        description:
          'Custom git executable path. Leave empty to auto detect. If it is not set, it will use the system git path.',
        placeholder:
          'e.g., /usr/bin/git or C:\\Program Files\\Git\\bin\\git.exe'
      }
    },
    tools: {
      label: 'Tools',
      copyAsPrompt: {
        label: 'Copy As Prompt',
        aiPrompt: {
          label: 'AI Prompt Template',
          description:
            'Template for copied content, use #{content} as a variable for file content'
        }
      },
      codeConvert: {
        label: 'Code Convert',
        convertLanguagePairs: {
          label: 'Convert Language Pairs',
          description: 'Default convert language pairs'
        },
        autoRememberConvertLanguagePairs: {
          label: 'Auto Remember Convert Language Pairs',
          description: 'Automatically remember convert language pairs'
        }
      },
      codeViewerHelper: {
        label: 'Code Viewer Helper',
        prompt: {
          label: 'Code Viewer Helper Prompt',
          description: 'Code viewer helper AI prompt template'
        }
      },
      expertCodeEnhancer: {
        label: 'Expert Code Enhancer',
        promptList: {
          label: 'Expert Code Enhancer Prompt List',
          description: 'Expert code enhancer AI prompt template list'
        }
      },
      smartPaste: {
        label: 'Smart Paste',
        readClipboardImage: {
          label: 'Read Clipboard Image',
          description:
            'Allow reading clipboard images as AI context in certain scenarios'
        }
      },
      batchProcessor: {
        label: 'Batch Processor',
        apiConcurrency: {
          label: 'API Concurrency',
          description:
            'API request concurrency, click to view online documentation'
        }
      }
    }
  }
}
