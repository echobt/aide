import type { McpConfigWithFullInfo } from '@extension/actions/mcp-actions'
import type { ActionRegister } from '@extension/registers/action-register'
import type { Mention } from '@shared/entities'
import type { MentionServerUtilsProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import {
  McpMentionType,
  type McpMention,
  type McpPromptWithConfigId,
  type McpToolWithConfigId
} from '../types'
import { getOriginalMcpConfig } from '../utils'

export class McpMentionServerUtilsProvider
  implements MentionServerUtilsProvider
{
  async createRefreshMentionFn(actionRegister: ActionRegister) {
    const mcpConfigs = await actionRegister
      .actions()
      .server.mcp.getConfigsWithFullInfo({
        actionParams: {}
      })

    // Create a map of doc site names for quick lookup
    const idMcpConfigMap = new Map<string, McpConfigWithFullInfo>()
    const idNameMcpToolMap = new Map<string, McpToolWithConfigId>()
    const idNameMcpPromptMap = new Map<string, McpPromptWithConfigId>()
    const createItemId = (configId: string, itemName: string) =>
      `${configId}#${itemName}`

    for (const config of mcpConfigs) {
      idMcpConfigMap.set(config.id, config)
      config.listTools.tools.forEach(tool => {
        const itemId = createItemId(config.id, tool.name)
        idNameMcpToolMap.set(itemId, {
          ...tool,
          configId: config.id
        })
      })
      config.listPrompts.prompts.forEach(prompt => {
        const itemId = createItemId(config.id, prompt.name)
        idNameMcpPromptMap.set(itemId, {
          ...prompt,
          configId: config.id
        })
      })
    }

    return (_mention: Mention) => {
      const mention = { ..._mention } as McpMention
      switch (mention.type) {
        // mcp config
        case McpMentionType.McpConfig:
          const mcpConfig = idMcpConfigMap.get(mention.data.id)
          if (mcpConfig) mention.data = getOriginalMcpConfig(mcpConfig)
          break

        // mcp tool
        case McpMentionType.McpTool:
          const mcpTool = idNameMcpToolMap.get(
            createItemId(mention.data.configId, mention.data.name)
          )
          if (mcpTool) mention.data = mcpTool
          break

        // mcp prompt
        case McpMentionType.McpPrompt:
          const mcpPrompt = idNameMcpPromptMap.get(
            createItemId(mention.data.configId, mention.data.name)
          )
          if (mcpPrompt) mention.data = mcpPrompt
          break
        default:
          break
      }

      return mention
    }
  }
}
