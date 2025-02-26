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
      '我们目前仅支持查看 Aide 模型聚合服务的使用信息。请查看：[https://aide.nicepkg.cn/zh/guide/use-another-llm/aide-models](https://aide.nicepkg.cn/zh/guide/use-another-llm/aide-models)'
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
  }
} satisfies ExtensionLocaleConfig
