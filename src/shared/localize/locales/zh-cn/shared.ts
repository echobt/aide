import type { SharedLocaleConfig } from '@shared/localize/types'

export default {
  aiProvider: {
    name: {
      custom: '自定义',
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      aide: 'Aide',
      azureOpenai: 'Azure OpenAI',
      vscodelm: 'VSCodeLM',
      unknown: ''
    },
    fields: {
      label: {
        customApiBaseUrl: '自定义第三方基础 URL',
        customApiKey: '自定义第三方 API 密钥',
        openaiApiBaseUrl: 'OpenAI 基础 URL',
        openaiApiKey: 'OpenAI API 密钥',
        anthropicApiUrl: 'Anthropic 基础 URL',
        anthropicApiKey: 'Anthropic API 密钥',
        aideApiBaseUrl: 'Aide 基础 URL',
        aideApiKey: 'Aide API 密钥',
        azureOpenaiBasePath: 'Azure OpenAI 基础路径',
        azureOpenaiApiKey: 'Azure OpenAI API 密钥',
        azureOpenaiApiVersion: 'Azure OpenAI API 版本',
        azureOpenaiApiDeploymentName: 'Azure OpenAI 部署名称',
        vscodeLmVendor: 'VSCodeLM 供应商'
      }
    },
    featureModelSetting: {
      default: '默认模型',
      chat: 'Chat 模型',
      composer: 'Composer 模型',
      v1: 'V1 模型',
      agent: 'Agent 模型',
      noPrompt: 'No Prompt 模型',
      completion: '补全模型',
      applyFile: '应用文件模型',
      batchProcessor: 'AI 批量处理文件模型',
      codeConvert: '代码转换模型',
      codeViewerHelper: '代码查看助手模型',
      expertCodeEnhancer: '让大师帮你改代码模型',
      renameVariable: '重命名变量模型',
      smartPaste: '智能粘贴模型'
    }
  },
  entities: {
    chatContext: {
      defaultTitle: '新聊天'
    },
    chatSession: {
      defaultTitle: '新聊天'
    },
    mcp: {
      validation: {
        nameRequired: '名称是必填项',
        commandRequired: '命令是必填项',
        invalidWebSocketUrl: '无效的 WebSocket URL',
        invalidSseUrl: '无效的 SSE URL'
      }
    }
  },
  plugins: {
    agents: {
      codebaseSearch: {
        title: '搜索代码库'
      },
      docRetriever: {
        title: '搜索文档'
      },
      editFile: {
        actions: {
          apply: '应用',
          reject: '拒绝',
          accept: '接受',
          reapply: '重新应用',
          copy: '复制',
          copyCode: '复制代码'
        },
        status: {
          generating: '生成中',
          reviewing: '审核中',
          accepted: '已接受',
          rejected: '已拒绝'
        },
        messages: {
          codeCopied: '代码已复制到剪贴板'
        },
        errors: {
          codeEditTaskNotFound: '未找到代码编辑任务',
          failedToApplyCode: '应用代码失败: {{error}}'
        },
        logs: {
          failedToApplyCode: '应用代码失败'
        }
      },
      mcpTool: {
        title: 'MCP 工具',
        preview: {
          input: '输入',
          output: '输出'
        }
      },
      readFiles: {
        title: '读取文件'
      },
      webSearch: {
        title: '搜索网页'
      },
      webVisit: {
        title: '访问网页'
      }
    },
    mentions: {
      doc: {
        docs: '文档',
        docsSetting: '文档设置'
      },
      fs: {
        files: '文件',
        folders: '文件夹',
        tree: '树',
        codebase: '代码库',
        errors: '错误',
        localProjects: '本地项目',
        gitProjects: 'Git 项目',
        localProjectsSetting: '本地项目设置',
        gitProjectsSetting: 'Git 项目设置'
      },
      git: {
        git: 'Git',
        diffWorkingState: '工作状态差异',
        prDiffWithMainBranch: '与主分支的差异'
      },
      mcp: {
        description: '描述',
        parameters: '参数',
        mcpSetting: 'MCP 设置',
        mcpEndpoints: 'MCP 端点'
      },
      promptSnippet: {
        promptSnippets: '提示片段',
        promptSnippetSetting: '提示片段设置',
        noCommands: '没有命令'
      },
      terminal: {
        terminals: '终端',
        noCommandHistory: '没有命令历史',
        exitCode: '退出码'
      },
      web: {
        web: '网页'
      }
    }
  },
  settings: {
    general: {
      label: '通用',
      language: {
        label: '语言',
        description: '选择扩展的语言'
      },
      theme: {
        label: '主题',
        description: '选择扩展的主题'
      },
      rulesForAI: {
        label: 'AI 规则',
        description: '这些规则会在所有聊天中显示给 AI。',
        placeholder:
          '例如："始终使用函数式 React，永远不要在 rust 中使用 unwrap，始终用葡萄牙语输出你的答案";'
      },
      respectGitIgnore: {
        label: '遵循 .gitignore',
        description: '遵循 .gitignore 文件'
      },
      additionalGitIgnore: {
        label: '额外的 .gitignore 规则',
        description: '与现有 .gitignore 文件组合的额外 .gitignore 规则',
        placeholder:
          '例如：\n# Node\nnode_modules/\n\n# Python\n__pycache__/\n*.pyc\n\n# Build\ndist/\nbuild/'
      },
      useSystemProxy: {
        label: '使用系统代理',
        description:
          '使用全局代理（HTTP_PROXY, HTTPS_PROXY, ALL_PROXY），更改此设置后需要重启 VSCode 才能生效'
      }
    },
    about: {
      label: '关于'
    },
    chat: {
      label: '聊天',
      defaultModel: {
        description: '如果未选择特定模型，将使用此模型'
      },
      chatModel: {
        label: 'AI 模型'
      },
      codebaseIndexing: {
        label: '代码库索引',
        description:
          '使用 Tree-sitter 解析并将代码分割成语义块，然后在数据库中创建向量嵌入。这使 AI 能够高效地搜索和理解您的代码库上下文。'
      },
      mcpManagement: {
        label: 'MCP 管理'
      },
      chatDoc: {
        label: '文档站点索引'
      },
      promptSnippets: {
        label: '提示片段'
      },
      projectManagement: {
        label: '本地项目'
      },
      gitProjectManagement: {
        label: 'Git 项目'
      },
      gitExecutablePath: {
        label: 'Git 可执行文件路径',
        description:
          '自定义 git 可执行文件路径。留空以自动检测。如果未设置，将使用系统 git 路径。',
        placeholder:
          '例如，/usr/bin/git 或 C:\\Program Files\\Git\\bin\\git.exe'
      }
    },
    tools: {
      label: '工具',
      copyAsPrompt: {
        label: '复制为提示',
        aiPrompt: {
          label: 'AI 提示模板',
          description: '复制内容的模板，使用 #{content} 作为文件内容的变量'
        }
      },
      codeConvert: {
        label: '代码转换',
        convertLanguagePairs: {
          label: '转换语言对',
          description: '默认转换语言对'
        },
        autoRememberConvertLanguagePairs: {
          label: '自动记住转换语言对',
          description: '自动记住转换语言对'
        }
      },
      codeViewerHelper: {
        label: '代码查看助手',
        prompt: {
          label: '代码查看助手提示',
          description: '代码查看助手 AI 提示模板'
        }
      },
      expertCodeEnhancer: {
        label: '专家代码增强器',
        promptList: {
          label: '专家代码增强器提示列表',
          description: '专家代码增强器 AI 提示模板列表'
        }
      },
      smartPaste: {
        label: '智能粘贴',
        readClipboardImage: {
          label: '读取剪贴板图像',
          description: '允许在某些场景中将剪贴板图像作为 AI 上下文读取'
        }
      },
      batchProcessor: {
        label: '批处理器',
        apiConcurrency: {
          label: 'API 并发',
          description: 'API 请求并发，点击查看在线文档'
        }
      }
    }
  }
} satisfies SharedLocaleConfig
