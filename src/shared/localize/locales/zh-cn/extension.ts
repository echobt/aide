import type { ExtensionLocaleConfig } from '@shared/localize/types'

// Chinese translations for extension
export default {
  command: {
    copyAsPrompt: '✨ Aide: 复制为 AI 提示词',
    codeConvert: '✨ Aide: 代码转换',
    codeViewerHelper: '✨ Aide: 代码查看器助手',
    expertCodeEnhancer: '✨ Aide: 让大师帮你改代码',
    renameVariable: '✨ Aide: 重命名变量',
    smartPaste: '✨ Aide: 智能粘贴',
    batchProcessor: '✨ Aide: AI 批量处理文件',
    openWebview: '✨ Aide: 打开 Webview',
    copyFileText: '复制全文',
    quickCloseFileWithoutSave: '快速关闭',
    replaceFile: '替换原文',
    showDiff: '对比原文',
    action: '执行 Aide 操作',
    inlineDiff: {
      accept: '接受',
      reject: '拒绝',
      acceptAll: '接受全部',
      rejectAll: '拒绝全部',
      showError: '显示错误'
    },
    chatHistoriesTree: {
      refresh: '刷新聊天记录',
      createAndOpenSession: '新建聊天并打开',
      deleteSession: '删除聊天记录',
      duplicateSession: '复制聊天记录'
    },
    promptSnippetTree: {
      refresh: '刷新提示词片段',
      createSnippet: '新建提示词片段',
      deleteSnippet: '删除提示词片段',
      duplicateSnippet: '复制提示词片段'
    }
  },
  view: {
    chatHistoriesTree: 'Aide 聊天历史',
    promptSnippetTree: 'Aide 提示词片段'
  },
  config: {
    title: 'Aide 配置',
    apiConcurrency: {
      description:
        'API 请求并发数, [点击查看在线文档](https://aide.nicepkg.cn/zh/guide/configuration/api-concurrency)'
    },
    useSystemProxy: {
      description:
        '是否使用全局代理 (`HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`) , 更改此设置后需要重启 `VSCode` 才生效, [点击查看在线文档](https://aide.nicepkg.cn/zh/guide/configuration/use-system-proxy)'
    },
    codeViewerHelperPrompt: {
      description:
        '代码查看器助手 AI 提示词模板, [点击查看在线文档](https://aide.nicepkg.cn/zh/guide/configuration/code-viewer-helper-prompt)'
    },
    expertCodeEnhancerPromptList: {
      description:
        '大师代码优化 AI 提示词模板列表, [点击查看在线文档](https://aide.nicepkg.cn/zh/guide/configuration/expert-code-enhancer-prompt-list)',
      solid: '使用 SOLID 原则优化',
      dry: '使用 DRY 原则优化',
      designPatterns: '应用适当的设计模式',
      splitComponents: '拆分为更小的组件',
      cleanliness: '提高代码整洁度',
      performance: '优化性能',
      databaseQueries: '优化数据库查询',
      security: '加强安全措施',
      concurrency: '优化并发和多线程',
      optimizeConditionals: 'if-else 清理大师'
    },
    convertLanguagePairs: {
      description:
        '默认转换语言对照表, [点击查看在线文档](https://aide.nicepkg.cn/zh/guide/configuration/convert-language-pairs)'
    },
    autoRememberConvertLanguagePairs: {
      description:
        '是否自动记住转换语言对照表, [点击查看在线文档](https://aide.nicepkg.cn/zh/guide/configuration/auto-remember-convert-language-pairs)'
    },
    readClipboardImage: {
      description:
        '是否允许某些场景读取剪贴板图片作为 AI 上下文, [点击查看在线文档](https://aide.nicepkg.cn/zh/guide/configuration/read-clipboard-image)'
    },
    aiPrompt: {
      description:
        '复制内容的模板，使用 `#{content}` 作为文件内容的变量, [点击查看在线文档](https://aide.nicepkg.cn/zh/guide/configuration/ai-prompt)'
    },
    ignorePatterns: {
      description:
        '忽略的文件名模式, 支持 `glob` 语法, [点击查看在线文档](https://aide.nicepkg.cn/zh/guide/configuration/ignore-patterns)'
    },
    respectGitIgnore: {
      description:
        '是否尊重 `.gitignore` 文件, [点击查看在线文档](https://aide.nicepkg.cn/zh/guide/configuration/respect-git-ignore)'
    }
  },
  input: {
    codeConvertTargetLanguage: {
      prompt: '选择转换目标语言'
    },
    selectAiSuggestionsVariableName: {
      prompt: '选择 AI 建议的变量名'
    },
    batchProcessor: {
      prompt: '让 AI 批量处理你选中的 {{filesCount}} 个文件，你想 AI 做什么？',
      placeholder: '比如：帮我从 python2 迁移到 python3'
    },
    expertCodeEnhancer: {
      selectPrompt: {
        title: '选择代码优化方式'
      },
      customPrompt: {
        placeholder: '自定义优化提示词'
      }
    }
  },
  error: {
    noWorkspace: '无法确定工作区文件夹',
    invalidConfigKey: '无效的配置键',
    invalidConfigValueType: '无效的配置值类型',
    invalidConfigValueOption: '无效的配置值选项',
    failedToUpdateConfig: '更新配置失败',
    invalidJson: '无效的 JSON 格式',
    invalidNumber: '无效的数字',
    invalidBaseUrl: '无效的 Base URL',
    invalidAzureOpenaiBaseUrl: '无效的 Azure OpenAI Base URL',
    vscodeLLMModelNotFound: '未找到 VSCode LLM 模型，请检查配置',
    noSelection: '未选择任何文件或文件夹',
    noActiveEditor: '请先打开任意一个文件以确定 workspace',
    noTargetLanguage: '未选择目标语言',
    noContext: '上下文未初始化',
    emptyClipboard: '剪贴板为空',
    xclipNotFound:
      'xclip 未安装。请使用你的包管理器安装它 (例如，sudo apt-get install xclip)',
    fileNotFound: '文件未找到',
    invalidInput: '无效的输入',
    aideKeyUsageInfoOnlySupportAideModels:
      '我们目前仅支持查看 Aide 模型聚合服务的使用信息。请查看：[https://aide.nicepkg.cn/zh/guide/use-another-llm/aide-models](https://aide.nicepkg.cn/zh/guide/use-another-llm/aide-models)',
    agentServerUtilsProvidersNotFound: '未找到AgentServerUtilsProviders',
    agentNameNotFound: '未找到代理名称',
    agentServerUtilsProviderNotFound:
      '未找到{{agentName}}的AgentServerUtilsProvider',
    chatContextNotFound: '未找到聊天上下文',
    conversationNotFound: '未找到对话',
    actionNotFound: '未找到操作',
    serverUtilsProvidersNotFound: '未找到ServerUtilsProviders'
  },
  info: {
    copied: '文件内容已复制到剪贴板',
    noAiSuggestionsVariableName: ' AI 觉得你这个变量名字已经很好了',
    processing: 'Aide 正在处理中...',
    continueMessage:
      '继续吗？我不确定是否已经完成了，如果还有内容没生成，你可以点击继续。',
    iconContinueMessage: '(你也可以点击原来的生成 icon 以继续)',
    continue: '继续',
    cancel: '取消',
    commandCopiedToClipboard: 'AI 命令已复制到剪贴板',
    fileReplaceSuccess: '文件内容已成功替换',
    batchProcessorSuccess:
      'AI 批量处理成功!\n\n共生成了 {{filesCount}} 个文件, 你可以自己 review 手动替换。\n\n已完成任务：\n{{tasks}}',
    loading: '加载中...'
  },
  file: {
    content: 'File: {{filePath}}\n```{{fileLanguage}}\n{{fileContent}}\n```\n\n'
  },
  agentActions: {
    agentServerUtilsProvidersNotFound: '未找到AgentServerUtilsProviders',
    agentNameNotFound: '未找到代理名称',
    agentServerUtilsProviderNotFound:
      '未找到{{agentName}}的AgentServerUtilsProvider',
    chatContextNotFound: '未找到聊天上下文',
    conversationNotFound: '未找到对话',
    actionNotFound: '未找到操作',
    serverUtilsProvidersNotFound: '未找到ServerUtilsProviders',
    checkpoint: '存档'
  },
  applyActions: {
    codeEditProviderNotFound: '未找到代码编辑提供程序',
    invalidSchemeUriParameter: '无效的schemeUri参数',
    newFileDoesNotNeedAiStream: '新文件不需要AI流'
  },
  chatSessionActions: {
    sessionNotFound: '未找到会话'
  },
  codebaseActions: {
    codebaseWatcherNotFound: '未找到代码库监视器',
    indexerNotFound: '未找到索引器'
  },
  gitProject: {
    validation: {
      nameRequired: '项目名称是必填项',
      nameNoSlashes: '项目名称不能包含斜杠或反斜杠',
      nameUnique: '项目名称必须唯一',
      invalidRepoUrl: '无效的仓库URL'
    },
    errors: {
      projectNotFound: '找不到项目'
    }
  },
  doc: {
    validation: {
      siteNameRequired: '站点名称是必填项',
      invalidUrl: '无效的URL'
    },
    errors: {
      siteNotFound: '找不到文档站点',
      crawlFirst: '请先爬取站点'
    }
  },
  mcp: {
    validation: {
      nameRequired: '名称是必填项',
      nameUnique: '名称必须唯一'
    },
    errors: {
      nameInUse: '名称已被使用',
      configNotFound: '找不到端点',
      connectionNotInitialized: 'Mcp 连接 {{id}} 未初始化',
      unsupportedTransportType: '不支持的传输类型: {{type}}'
    }
  },
  mention: {
    errors: {
      providersNotFound: '未找到提及服务提供者',
      actionRegisterNotFound: '未找到操作注册器'
    }
  },
  project: {
    validation: {
      nameRequired: '项目名称是必填项',
      nameNoSlashes: '项目名称不能包含斜杠或反斜杠',
      nameUnique: '项目名称必须唯一',
      pathRequired: '项目路径是必填项'
    }
  },
  promptSnippet: {
    validation: {
      titleRequired: '标题是必填项',
      titleUnique: '标题必须唯一'
    },
    errors: {
      snippetNotFound: '找不到ID为{{id}}的片段'
    }
  },
  settings: {
    webview: {
      title: 'Aide 设置'
    },
    errors: {
      webviewProviderNotFound: '未找到Webview提供者',
      invalidGitPath: '无效的Git可执行文件路径'
    }
  },
  system: {
    errors: {
      webviewProviderNotFound: '未找到Webview提供者'
    }
  },
  webvm: {
    validation: {
      presetNameRequired: '预设名称是必填项',
      frameworkNameRequired: '框架名称是必填项',
      projectNameRequired: '项目名称是必填项',
      sessionIdRequired: '会话ID是必填项',
      filePathRequired: '文件路径是必填项'
    },
    errors: {
      webviewProviderNotFound: '未找到Webview提供者',
      webvmRegisterNotFound: '未找到WebVM注册器',
      presetNotFound: '未找到预设 {{presetName}}',
      invalidWebvmUri: '无效的webvm URI: scheme不是webvm'
    },
    webview: {
      title: 'V1 预览'
    },
    projectManager: {
      initUsingPreset: '[初始化] 使用预设: {{presetName}}'
    },
    orchestrator: {
      errors: {
        initProjectFailed: '初始化项目失败'
      },
      cleanup: '[清理] 开发服务器已停止'
    }
  },
  workspaceCheckpoint: {
    errors: {
      notInitialized: '工作区存档未初始化',
      restrictedDirectory: '无法在 {{directory}} 目录中创建存档',
      directoryNotExist: '工作目录不存在: {{directory}}',
      createFailed: '创建存档失败:',
      restoreFailed: '恢复存档失败:',
      writeFileFailed: '写入文件到内存文件系统失败: {{relativePath}}',
      operationFailed: '操作失败，尝试恢复中:',
      recoveryFailed: '恢复失败:',
      operationAndRecoveryFailed: '操作失败且无法恢复: {{error}}',
      disposeFailed: '释放存档资源失败:'
    },
    git: {
      errors: {
        noCommitsNoFiles: '没有找到提交记录且没有文件可提交'
      }
    }
  },
  embeddings: {
    errors: {
      noActiveModel: '未设置活动嵌入模型',
      pipelineNotInitialized: '管道未初始化',
      embeddingError: '嵌入过程中出错: {{message}}'
    },
    info: {
      localProviderInitialized: '本地嵌入提供者已初始化'
    }
  },
  modelProviders: {
    errors: {
      modelNameRequired: '模型名称是必填项，请检查您的AI模型设置',
      providerNotFound: '未找到提供者: {{providerId}}',
      modelNotFound: '未找到模型: {{modelName}}',
      unsupportedProviderType: '不支持的提供者类型: {{type}}',
      missingProviderOrModel: '您忘记在设置中设置提供者或模型，请检查您的设置。'
    }
  },
  chat: {
    baseNode: {
      missingProperties: 'Agent上下文缺少必需的属性',
      strategyProviderNotFound: '未找到聊天策略提供者'
    },
    chatStrategy: {
      providerNotFound: '未找到聊天策略提供者'
    },
    composerStrategy: {
      providerNotFound: '未找到Composer策略提供者'
    },
    noPromptStrategy: {
      providerNotFound: '未找到NoPrompt策略提供者'
    },
    v1Strategy: {
      chatProviderNotFound: '未找到聊天策略提供者'
    },
    docCrawler: {
      pageNotFound: '页面未找到: {{url}}',
      httpError: 'HTTP错误! 状态码: {{status}}',
      timeoutFetching: '获取{{url}}超时',
      failedToGetContent: '获取{{pageUrl}}内容失败:',
      pageContentTooLarge: '页面内容过大',
      extractedContentTooSmall: '提取的内容太小',
      failedToProcessPage: '处理页面{{pageUrl}}失败: {{error}}',
      tooLarge: '过大',
      tooSmall: '过小',
      skippingDueTo: '由于{{error}}跳过{{pageUrl}}',
      maxRetriesExceeded: '{{pageUrl}}已达到最大重试次数',
      errorCrawling: '爬取{{pageUrl}}出错:'
    },
    codeSnippet: {
      startLineGreaterThanEndLine: '起始行不能大于结束行'
    },
    conversation: {
      serverUtilsProvidersNotFound: '未找到ServerUtilsProviders'
    }
  },
  vfs: {
    errors: {
      noHandlerFound: '找不到URI的处理程序: {{uri}}'
    },
    workspace: {
      errors: {
        noPathProvided: '未提供相对路径或完整路径'
      }
    },
    webvm: {
      errors: {
        missingProjectId: '无效的webvm URI: 缺少项目ID',
        missingPresetName: '无效的webvm URI: 缺少预设名称',
        notImplemented: '未实现'
      }
    },
    project: {
      errors: {
        projectNotFound: '找不到项目: {{name}}',
        missingProjectName: '无效的项目URI: 缺少项目名称',
        notImplemented: '未实现'
      }
    },
    gitProject: {
      errors: {
        missingType: '无效的git项目URI: 缺少类型',
        missingProjectName: '无效的git项目URI: 缺少项目名称',
        notImplemented: '未实现'
      }
    },
    doc: {
      errors: {
        siteNotFound: '找不到站点: {{siteName}}',
        missingSiteName: '无效的文档URI: 缺少站点名称',
        notImplemented: '未实现'
      }
    },
    ensureDir: {
      errors: {
        invalidCharacters: '路径包含无效字符: {{path}}'
      }
    }
  },
  tmpFile: {
    errors: {
      missingLanguageIdOrTmpFileUri:
        "createTmpFileAndWriter: 必须提供'languageId'或'tmpFileUri'。"
    }
  },
  commands: {
    openWebview: {
      errors: {
        providerNotFound: '找不到WebView提供程序'
      }
    },
    action: {
      errors: {
        registerNotFound: '找不到ActionRegister'
      }
    }
  },
  git: {
    errors: {
      executableNotFound:
        'Git 可执行文件未找到。请安装 git 或在设置中设置自定义路径。'
    }
  },
  paths: {
    errors: {
      noContext: '未找到上下文'
    }
  },
  traverseFs: {
    errors: {
      emptySchemeUris: 'schemeUris 为空'
    }
  },
  state: {
    registerManagerNotSet: '注册管理器未设置',
    actionRegisterNotSet: '操作注册器未设置'
  },
  aiProvider: {
    providerOrBaseUrlRequired: '提供者或基础 URL 是必需的'
  },
  webview: {
    errors: {
      actionRegisterNotFound: '未找到操作注册器'
    }
  },
  codeEdit: {
    errors: {
      taskNotFound: '未找到任务'
    }
  },
  serverPlugin: {
    vscode: {
      internalToolMessage: 'Aide 扩展内部工具，请勿使用。',
      internalToolTitle: 'Aide 扩展内部工具',
      internalToolConfirmMessage: 'Aide 扩展内部工具，请勿使用。'
    }
  }
} satisfies ExtensionLocaleConfig
