import type { WebviewLocaleConfig } from '@shared/localize/types'

export default {
  globalSearch: {
    history: '历史',
    chatHistory: '聊天历史',
    settings: '设置',
    navigate: '导航',
    select: '选择',
    switchTab: '切换标签',
    close: '关闭',
    all: '全部',
    typeToSearch: '输入以搜索...',
    noResults: '未找到结果。'
  },
  theme: {
    followVSCode: '跟随 VS Code',
    darkSlate: '深色石板',
    darkZinc: '深色锌',
    darkRose: '深色玫瑰',
    darkEmerald: '深色祖母绿',
    darkViolet: '深色紫罗兰',
    darkCrimson: '深色绯红',
    lightGray: '浅色灰',
    lightSky: '浅色天空',
    lightTeal: '浅色蓝绿',
    lightAmber: '浅色琥珀',
    lightRose: '浅色玫瑰',
    midnight: '午夜',
    sunset: '日落',
    forest: '森林',
    ocean: '海洋',
    candy: '糖果',
    selectTheme: '选择主题'
  },
  settings: {
    failedToUpdate: '更新设置失败',
    updateSuccess: '设置更新成功',
    searchSettings: '搜索设置...',
    title: '设置',
    hideSecret: '隐藏密钥',
    showSecret: '显示密钥'
  },
  actions: {
    failedToStartWebPreview: '启动网页预览操作失败',
    failedToStartEditFile: '启动文件编辑操作失败',
    editFileByComposer: '通过编辑器编辑文件',
    collapseCode: '折叠代码',
    expandCode: '展开代码',
    actionsCount: '操作 ({{count}})',
    rejectAll: '全部拒绝',
    acceptAll: '全部接受'
  },
  jsonEditor: {
    basic: '基础',
    resetToDefault: '重置为默认值',
    clearEditor: '清空编辑器',
    format: '格式化',
    minifyJSON: '压缩 JSON',
    prettifyJSON: '美化 JSON',
    fixJSON: '修复 JSON',
    file: '文件',
    downloadJSON: '下载 JSON',
    uploadJSON: '上传 JSON',
    error: '错误',
    failedToMinify: '压缩 JSON 失败',
    failedToPrettify: '美化 JSON 失败',
    failedToFix: '修复 JSON 失败',
    unknownError: '未知错误',
    invalidJSON: '无效的 JSON',
    failedToFormat: '格式化 JSON 失败'
  },
  chatSidebar: {
    delete: '删除',
    chat: '聊天',
    searchChats: '搜索聊天...'
  },
  chatUI: {
    search: '搜索',
    newChat: '新建聊天',
    settings: '设置',
    cancel: '取消',
    cancelTooltip: '取消消息生成或按 ⌘⌫'
  },
  modelSelector: {
    default: '默认',
    extendsDefault: '继承默认模型',
    selectModel: '选择模型',
    setting: '设置',
    noModelsAvailable: '没有可用的 AI 模型',
    addNewProvider: '添加新提供商',
    manageProviders: '管理提供商'
  },
  webPreview: {
    presetNameRequired: '需要预设名称',
    failedToStartPreview: '启动预览虚拟机文件失败',
    failedToStopPreview: '停止预览虚拟机失败',
    noProjectFound: '未找到项目'
  },
  code: {
    failedToApply: '应用代码失败',
    applicationCancelled: '代码应用已取消'
  },
  chat: {
    aiRequestFailed: 'AI 请求失败',
    failedToSaveSession: '保存会话失败',
    failedToRefreshSessions: '刷新聊天会话失败',
    failedToCreateAndSwitchChat: '创建并切换到新聊天失败',
    failedToDeleteChat: '删除聊天 {{id}} 失败',
    failedToDeleteChats: '删除聊天 {{ids}} 失败',
    contextNotFound: '找不到聊天上下文',
    failedToRefreshSession: '刷新会话 {{id}} 失败',
    typeMessageHere: '在此输入您的消息...',
    webExample: '@web React18 和 React19 之间有什么区别？',
    fileReviewExample: '@main.ts 请审查这段代码',
    sendShortcut: '您可以使用 ⌘↩ 发送消息',
    send: '发送'
  },
  chatType: {
    title: '聊天类型',
    selectPlaceholder: '选择聊天类型',
    chatDescription: '与 AI 助手的标准聊天',
    composerDescription: 'AI 辅助代码编辑和生成',
    v1Description: '预览和交互网页应用',
    noPromptDescription: '无系统提示词的聊天'
  },
  aiModel: {
    title: 'AI 模型',
    configureFirst: '您需要先配置 AI 提供商',
    configureModel: '配置 AI 模型',
    providerAddedSuccess: 'AI 提供商添加成功',
    failedToAddProvider: '添加 AI 提供商失败',
    chooseDefaultModel: '为此聊天类型选择默认模型',
    chooseModelFor: '为 {{contextType}} 聊天选择模型'
  },
  preset: {
    title: '网页预设',
    selectPlaceholder: '选择预设'
  },
  centerHints: {
    configure: '配置您的聊天'
  },
  common: {
    edit: '编辑',
    delete: '删除',
    cancel: '取消',
    update: '更新',
    add: '添加',
    global: '全局',
    workspace: '工作区',
    copy: '复制',
    open: '打开',
    back: '返回',
    next: '下一步',
    connected: '已连接',
    disconnected: '已断开连接',
    error: '错误',
    completed: '已完成',
    processing: '处理中',
    pending: '待定'
  },
  error: {
    title: '出现了问题！',
    exportDescription: '您可以导出错误日志帮助我们诊断问题。',
    exportLogs: '导出错误日志',
    exportLogsTooltip: '导出详细错误日志以便排查问题',
    tryAgain: '重试'
  },
  promptSnippet: {
    title: '提示片段',
    snippet: '片段',
    searchPlaceholder: '搜索提示片段...',
    untitled: '未命名',
    removedSuccessfully: '提示片段已成功删除',
    failedToRemove: '删除提示片段失败',
    addedSuccessfully: '新提示片段添加成功',
    failedToAdd: '添加提示片段失败',
    updatedSuccessfully: '提示片段更新成功',
    failedToUpdate: '更新提示片段失败',
    editTitle: '编辑提示片段',
    addNewTitle: '添加新提示片段',
    enterTitle: '输入片段标题',
    selectSaveType: '选择保存类型',
    deleteTitle: '删除提示片段',
    deleteConfirmation: '确定要删除"{{title}}"吗？',
    messagesInConversation: '对话中有 {{count}} 条消息'
  },
  messages: {
    waitForCompletion: '请停止或等待当前消息完成。',
    createNewSession: '从此处创建新会话',
    freeze: '冻结',
    unfreeze: '解冻',
    freezeCurrentMessage: '冻结当前消息',
    freezeCurrentAndPrevious: '冻结当前和之前的消息',
    unfreezeCurrentMessage: '解冻当前消息',
    unfreezeCurrentAndPrevious: '解冻当前和之前的消息',
    deleteItems: '删除项目',
    deleteConfirmation: '确定要删除吗？',
    restoreCheckpoint: '恢复存档',
    restoreCheckpointConfirmation: '您想要恢复存档吗？',
    restore: '恢复',
    regenerate: '重新生成',
    regenerateWithCheckpointConfirmation: '您想在重新生成前恢复存档吗？',
    restoreBeforeSendConfirmation: '您想在发送消息前恢复工作区存档吗？',
    sendWithoutRestore: '否，直接发送',
    restoreAndSend: '是，恢复并发送'
  },
  codeBlock: {
    codeCopied: '代码已复制到剪贴板',
    openFileInEditor: '在编辑器中打开文件',
    copyCode: '复制代码',
    stopping: '正在停止...',
    reapply: '重新应用',
    apply: '应用'
  },
  mermaid: {
    codeCopied: 'Mermaid 代码已复制到剪贴板',
    copyCode: '复制 Mermaid 代码'
  },
  timeline: {
    generating: '生成中',
    open: '打开'
  },
  v1project: {
    waitForConversationEnd: '请等待对话结束。',
    noFilePath: '未找到文件路径。',
    moved: '已移动',
    deleted: '已删除',
    modified: '已修改',
    generated: '已生成',
    unknownProject: '未知项目'
  },
  thinks: {
    thought: '思考',
    thinking: '思考中...'
  },
  fileSelector: {
    files: '文件',
    addFiles: '添加文件',
    clearFiles: '清空文件',
    navigate: '导航',
    select: '选择',
    expand: '展开',
    switchTab: '切换标签',
    close: '关闭',
    list: '列表',
    tree: '文件树',
    searchFiles: '搜索文件...',
    noFilesFound: '未找到文件。'
  },
  mentionSelector: {
    noResults: '未找到结果。'
  },
  contextSelector: {
    addMention: '添加上下文',
    addImage: '添加图片',
    exitEditMode: '退出编辑模式'
  },
  cardList: {
    noItemsYet: '暂无项目',
    createItem: '创建项目',
    createNewItem: '创建新项目',
    new: '新建',
    deleteItems: '删除项目',
    deleteConfirmation: '确定要删除 {{count}} 个选中的项目吗？',
    delete: '删除',
    deleteSelectedItems: '删除选中的项目',
    selectedItemsCount: '已选择 {{count}} 个项目'
  },
  sidebarList: {
    noItems: '没有{{itemName}}',
    createNewItem: '创建新{{itemName}}',
    new: '新建',
    deleteItems: '删除项目',
    deleteConfirmation: '确定要删除 {{count}} 个选中的项目吗？',
    delete: '删除',
    deleteSelectedItems: '删除 {{count}} 个选中的{{itemName}}',
    selectedItemsCount: '已选择 {{count}} 个{{itemName}}'
  },
  alertAction: {
    areYouSure: '确定吗？',
    cannotBeUndone: '此操作无法撤销。',
    cancel: '取消',
    continue: '继续'
  },
  collapsibleBlock: {
    loading: '加载中',
    waiting: '等待中',
    success: '成功',
    error: '错误',
    collapseCode: '折叠代码',
    expandCode: '展开代码'
  },
  about: {
    contributors: '贡献者',
    contributorsDescription: '感谢所有让这个项目成为可能的贡献者',
    creatorRole: '创建者',
    creatorDescription: 'Aide 的创建者和维护者',
    installs: '安装量',
    stars: '星标数',
    forks: '分支数',
    subscribers: '订阅者',
    visitWebsite: '访问网站',
    starOnGitHub: '在 GitHub 上点赞',
    contributions: '贡献',
    createdWith: '由',
    by: '创建，带着',
    reportIssue: '报告问题',
    exportLogs: '导出日志',
    exportLogsTooltip: '导出诊断日志以便排查问题'
  },
  language: {
    followVSCode: '跟随 VSCode',
    selectLanguage: '选择语言'
  },
  aiProvider: {
    modelManagement: '模型管理',
    manualModels: '手动模型',
    remoteModels: '远程模型',
    addModels: '添加模型',
    enterModelNamesOneLine: '输入模型名称，每行一个',
    modelNamesPlaceholder:
      '输入模型名称（每行一个），例如：\ngpt-4o\nclaude-3-5-sonnet\nclaude-3-7-sonnet',
    testAllFeatures: '测试所有功能',
    addToManual: '添加到手动模型',
    removeFromManual: '从手动模型中移除',
    failedToUpdateRemoteModels: '更新提供商远程模型失败',
    failedToTestModelFeatures: '测试模型功能失败',
    features: {
      chat: '聊天',
      imageInput: '图像输入',
      imageOutput: '图像输出',
      audioInput: '音频输入',
      audioOutput: '音频输出',
      toolsCall: '工具调用'
    },
    // Provider form related
    providerType: '提供商类型',
    providerName: '提供商名称',
    selectProviderType: '选择提供商类型',
    enterProviderName: '输入提供商名称',
    providerSettings: '提供商设置',
    modelSettings: '模型设置',
    providerSetupSteps: '提供商设置步骤',
    saving: '保存中...',
    complete: '完成',
    providerConfiguration: '提供商配置',
    saveChanges: '保存更改',
    // Provider card related
    showValue: '显示值',
    hideValue: '隐藏值',
    deleteProvider: '删除提供商',
    deleteProviderConfirmation: '确定要删除提供商"{{name}}"吗？',
    viewUsage: '查看使用情况',
    // Provider form dialog related
    editModel: '编辑模型',
    createModel: '创建模型',
    failedToSaveProvider: '保存提供商失败',
    // Provider management related
    providerAddedSuccess: '提供商添加成功',
    providerUpdatedSuccess: '提供商更新成功',
    providersRemovedSuccess: '提供商删除成功',
    failedToAddProvider: '添加提供商失败',
    failedToUpdateProvider: '更新提供商失败',
    failedToRemoveProviders: '删除提供商失败',
    allModelSettings: '所有模型设置',
    // Provider usage dialog related
    usageInformationUnavailable: '使用信息不可用',
    usageTrackingIssue: '此提供商可能不支持使用情况跟踪，或者连接出现问题。',
    usageOverview: '使用概览',
    currentBillingPeriod: '当前计费周期',
    usedAmount: '已使用金额',
    remaining: '剩余',
    totalTokensUsed: '已使用令牌总数',
    subscriptionPeriod: '订阅周期',
    validUntil: '有效期至',
    usageInformation: '使用信息',
    // Validation messages
    validation: {
      isRequired: '是必填项',
      providerNameRequired: '提供商名称是必填项',
      providerTypeRequired: '提供商类型是必填项',
      typeAndNameRequired: '提供商类型和名称是必填项',
      missingRequiredFields: '缺少必填字段：{{fields}}',
      providerNameExists: '提供商名称已存在',
      networkError: '网络错误，请重试'
    }
  },
  // Git 项目管理
  gitProject: {
    searchPlaceholder: '搜索 Git 项目...',
    addedSuccess: '新 Git 项目添加成功',
    updatedSuccess: 'Git 项目更新成功',
    removedSuccess: 'Git 项目删除成功',
    refreshedSuccess: 'Git 项目刷新成功',
    failedToAdd: '添加 Git 项目失败',
    failedToUpdate: '更新 Git 项目失败',
    failedToRemove: '删除 Git 项目失败',
    failedToRefresh: '刷新 Git 项目失败',
    addProject: '添加 Git 项目',
    editProject: '编辑 Git 项目',
    updateProject: '更新 Git 项目',
    deleteProject: '删除 Git 项目',
    deleteProjectConfirmation: '确定要删除"{{name}}"吗？',
    addProjectDescription: '通过输入以下详细信息添加新的 Git 项目',
    editProjectDescription: '编辑您的 Git 项目详细信息',
    repositoryUrl: '仓库 URL',
    enterRepositoryUrl: '输入仓库 URL',
    name: '名称',
    enterProjectName: '输入项目名称',
    type: '类型',
    selectRepositoryType: '选择仓库类型',
    description: '描述',
    enterProjectDescription: '输入项目描述',
    refreshRepository: '刷新仓库',
    validation: {
      nameRequired: '项目名称是必填项',
      repoUrlRequired: '仓库 URL 是必填项',
      invalidUrl: '无效的 URL'
    }
  },
  // 文档站点管理
  docSite: {
    searchPlaceholder: '搜索文档站点...',
    addedSuccess: '新文档站点添加成功',
    updatedSuccess: '文档站点更新成功',
    removedSuccess: '文档站点删除成功',
    failedToAdd: '添加文档站点失败',
    failedToUpdate: '更新文档站点失败',
    failedToRemove: '删除文档站点失败',
    addSite: '添加站点',
    addNewSite: '添加新文档站点',
    editSite: '编辑文档站点',
    updateSite: '更新站点',
    deleteSite: '删除文档站点',
    deleteSiteConfirmation:
      '确定要删除"{{name}}"吗？这将删除所有已爬取和索引的数据。',
    enterSiteName: '输入文档站点名称',
    enterSiteUrl: '输入文档站点 URL',
    crawl: '爬取',
    index: '索引',
    actionPrefix: '重新{{action}}',
    stop: '停止',
    lastUpdate: '最后更新'
  },
  // MCP Management
  mcp: {
    searchPlaceholder: '搜索 MCP 端点...',
    addedSuccess: '新的 MCP 端点添加成功',
    updatedSuccess: 'MCP 端点更新成功',
    removedSuccess: 'MCP 端点删除成功',
    reconnectedSuccess: '重新连接成功',
    failedToAdd: '添加 MCP 端点失败',
    failedToUpdate: '更新 MCP 端点失败',
    failedToRemove: '删除 MCP 端点失败',
    failedToReconnect: '重新连接失败',
    failedToUpdateConfig: '更新端点失败',
    failedToSave: '保存 MCP 端点失败',
    reconnect: '重新连接',
    enabled: '已启用',
    disabled: '已禁用',
    deleteEndpoint: '删除 MCP 端点',
    deleteConfirmation: '确定要删除"{{name}}"吗？',
    editConfiguration: '编辑 MCP 端点',
    addConfiguration: '添加 MCP 端点',
    updateConfiguration: '更新端点',
    name: '名称',
    enterName: '输入端点名称',
    transportType: '传输类型',
    selectTransportType: '选择传输类型',
    enableNow: '立即启用',
    command: '命令',
    enterCommand: '输入命令',
    url: 'URL',
    enterUrl: '输入 URL'
  },
  // Project Management
  project: {
    searchPlaceholder: '搜索项目...',
    addedSuccess: '新项目添加成功',
    updatedSuccess: '项目更新成功',
    removedSuccess: '项目删除成功',
    failedToAdd: '添加项目失败',
    failedToUpdate: '更新项目失败',
    failedToRemove: '删除项目失败',
    deleteProject: '删除项目',
    deleteConfirmation: '确定要删除"{{name}}"吗？',
    editProject: '编辑项目',
    addProject: '添加新项目',
    updateProject: '更新项目',
    folderPath: '文件夹路径',
    enterFolderPath: '输入项目文件夹路径',
    name: '名称',
    enterName: '输入项目名称',
    description: '描述',
    enterDescription: '输入项目描述',
    validation: {
      nameRequired: '项目名称为必填项',
      pathRequired: '项目路径为必填项'
    }
  },
  // Codebase Indexing
  codebase: {
    indexingInProgress: '索引进行中...',
    neverIndexed: '从未索引',
    lastIndexed: '上次索引时间：{{date}}',
    lastIndexingFailed: '上次索引失败：{{date}}',
    indexing: '索引中...',
    reindex: '重新索引',
    startIndexing: '开始索引',
    stop: '停止',
    percentCompleted: '已完成 {{percent}}%'
  },
  // WebVM related translations
  webvm: {
    tabs: {
      preview: '预览',
      code: '代码',
      console: '控制台'
    },
    restartServer: '重启服务器',
    preview: {
      back: '后退',
      forward: '前进',
      refresh: '刷新',
      enterUrl: '输入 URL',
      switchToMobile: '切换到移动视图',
      switchToTablet: '切换到平板视图',
      switchToDesktop: '切换到桌面视图',
      openInBrowser: '在浏览器中打开',
      fullscreen: '全屏',
      exitFullscreen: '退出全屏'
    },
    console: {
      title: '控制台',
      enterJavaScript: '输入 JavaScript 代码...'
    },
    code: {
      newFile: '新建文件',
      newFolder: '新建文件夹',
      rename: '重命名',
      renameFile: '重命名文件',
      deleteFileConfirmation: '这将删除文件"{{name}}"。',
      deleteFolderConfirmation: '这将删除文件夹"{{name}}"及其所有内容。'
    }
  }
} satisfies WebviewLocaleConfig
