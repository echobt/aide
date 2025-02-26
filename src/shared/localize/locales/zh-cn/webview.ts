import type { WebviewLocaleConfig } from '@shared/localize/types'

// Chinese translations for webview
export default {
  common: {
    loading: '加载中...',
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    close: '关闭',
    search: '搜索',
    submit: '提交',
    reset: '重置',
    copy: '复制',
    paste: '粘贴',
    upload: '上传',
    download: '下载',
    success: '成功',
    error: '错误',
    warning: '警告',
    info: '信息'
  },
  chat: {
    newChat: '新建聊天',
    sendMessage: '发送消息',
    typeMessage: '输入消息...',
    clearChat: '清空聊天',
    copyCode: '复制代码',
    regenerate: '重新生成',
    stop: '停止',
    continue: '继续',
    thinking: '思考中...',
    processing: '处理中...'
  },
  settings: {
    title: '设置',
    language: '语言',
    theme: '主题',
    apiKey: 'API 密钥',
    model: '模型',
    temperature: '温度',
    maxTokens: '最大令牌数',
    saveSettings: '保存设置',
    resetSettings: '重置设置'
  },
  sidebar: {
    chat: '聊天',
    files: '文件',
    settings: '设置',
    help: '帮助',
    about: '关于'
  }
} satisfies WebviewLocaleConfig
