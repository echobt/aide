import type { McpConfig, McpPrompt, McpTool, Mention } from '@shared/entities'

import { MentionPluginId } from '../_base/types'

export enum McpMentionType {
  McpConfig = `${MentionPluginId.Mcp}#mcp-config`,
  McpConfigSetting = `${MentionPluginId.Mcp}#mcp-config-setting`,
  McpTool = `${MentionPluginId.Mcp}#mcp-tool`,
  McpPrompt = `${MentionPluginId.Mcp}#mcp-prompt`
}

export type McpToolWithConfigId = McpTool & {
  configId: string
}

export type McpPromptWithConfigId = McpPrompt & {
  configId: string
}

export type McpConfigMention = Mention<McpMentionType.McpConfig, McpConfig>

export type McpToolMention = Mention<
  McpMentionType.McpTool,
  McpToolWithConfigId
>

export type McpPromptMention = Mention<
  McpMentionType.McpPrompt,
  McpPromptWithConfigId
>

export type McpMention = McpConfigMention | McpToolMention | McpPromptMention
