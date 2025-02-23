import type {
  ListPromptsResult,
  ListToolsResult
} from '@modelcontextprotocol/sdk/types.js'
import { GearIcon } from '@radix-ui/react-icons'
import type { McpConfig } from '@shared/entities'
import {
  createMentionClientPlugin,
  type MentionClientPluginSetupProps
} from '@shared/plugins/mentions/_base/client/create-mention-client-plugin'
import type { UseMentionOptionsReturns } from '@shared/plugins/mentions/_base/client/mention-client-plugin-types'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'
import { useQuery } from '@tanstack/react-query'
import { useOpenSettingsPage } from '@webview/hooks/api/use-open-settings-page'
import { api } from '@webview/network/actions-api'
import { type MentionOption } from '@webview/types/chat'
import { BookOpenText, HammerIcon, Router } from 'lucide-react'

import {
  McpMentionType,
  type McpPromptWithConfigId,
  type McpToolWithConfigId
} from '../types'
import { getOriginalMcpConfig } from '../utils'
import { MentionMcpPromptPreview } from './mention-mcp-prompt-preview'
import { MentionMcpToolPreview } from './mention-mcp-tool-preview'

export const McpMentionClientPlugin = createMentionClientPlugin({
  id: MentionPluginId.Mcp,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('useMentionOptions', () => createUseMentionOptions(props))
  }
})

const createUseMentionOptions =
  (props: MentionClientPluginSetupProps) => (): UseMentionOptionsReturns => {
    const { openSettingsPage } = useOpenSettingsPage()

    const { data: mcpConfigs = [] } = useQuery({
      queryKey: ['realtime', 'mcpConfigs', 'mcpConfigsFullInfo'],
      queryFn: async () => {
        const configs = await api.actions().server.mcp.getConfigsWithFullInfo({
          actionParams: {}
        })

        return configs.filter(
          config => config.isEnabled && config.status.isConnected
        )
      }
    })

    const mcpConfigSettingMentionOption: MentionOption = {
      id: McpMentionType.McpConfigSetting,
      type: McpMentionType.McpConfigSetting,
      label: 'MCP Setting',
      disableAddToEditor: true,
      onSelect: () => {
        openSettingsPage({ pageId: 'mcpManagement' })
      },
      searchKeywords: ['setting', 'mcp', 'mcpconfigsetting'],
      itemLayoutProps: {
        icon: <GearIcon className="size-4 mr-1" />,
        label: 'MCP Setting',
        details: ''
      }
    }

    const mcpConfigsMentionOptions: MentionOption[] = mcpConfigs.map(config => {
      const label = config.name
      const mcpToolOptions: MentionOption<ListToolsResult['tools'][number]>[] =
        []
      const mcpPromptOptions: MentionOption<
        ListPromptsResult['prompts'][number]
      >[] = []

      config.listTools.tools.forEach(tool => {
        const toolLabel = tool.name
        const toolWithConfigId: McpToolWithConfigId = {
          ...tool,
          configId: config.id
        }

        mcpToolOptions.push({
          id: `${McpMentionType.McpTool}#${tool.name}`,
          type: McpMentionType.McpTool,
          label: toolLabel,
          data: toolWithConfigId,
          searchKeywords: [
            'tool',
            config.name,
            toolLabel,
            tool.description || ''
          ],
          itemLayoutProps: {
            icon: <HammerIcon className="size-4 mr-1" />,
            label: toolLabel,
            details: tool.description || ''
          },
          customRenderPreview: MentionMcpToolPreview
        })
      })

      config.listPrompts.prompts.forEach(prompt => {
        const promptLabel = prompt.name
        const promptWithConfigId: McpPromptWithConfigId = {
          ...prompt,
          configId: config.id
        }

        mcpPromptOptions.push({
          id: `${McpMentionType.McpPrompt}#${prompt.name}`,
          type: McpMentionType.McpPrompt,
          label: promptLabel,
          data: promptWithConfigId,
          searchKeywords: [
            'prompt',
            config.name,
            promptLabel,
            prompt.description || ''
          ],
          itemLayoutProps: {
            icon: <BookOpenText className="size-4 mr-1" />,
            label: promptLabel,
            details: prompt.description || ''
          },
          customRenderPreview: MentionMcpPromptPreview
        })
      })

      return {
        id: `${McpMentionType.McpConfig}#${config.id}`,
        type: McpMentionType.McpConfig,
        label,
        data: getOriginalMcpConfig(config),
        searchKeywords: [label],
        itemLayoutProps: {
          icon: <Router className="size-4 mr-1" />,
          label,
          details: config.description || ''
        },
        children: [...mcpToolOptions, ...mcpPromptOptions]
      } satisfies MentionOption<McpConfig>
    })

    return [
      {
        id: McpMentionType.McpConfig,
        type: McpMentionType.McpConfig,
        label: 'MCP',
        topLevelSort: 10,
        searchKeywords: ['mcp', 'mcpconfig', 'tools', 'prompts'],
        children: [mcpConfigSettingMentionOption, ...mcpConfigsMentionOptions],
        itemLayoutProps: {
          icon: <Router className="size-4 mr-1" />,
          label: 'MCP'
        }
      }
    ]
  }
