import { runAction } from '@extension/state'
import type { Agent } from '@shared/entities'
import {
  BaseNode,
  dispatchBaseGraphState,
  type ChatGraphState
} from '@shared/plugins/_shared/strategies'
import { createMcpToolAgentClass } from '@shared/plugins/agents/mcp-tool-agent-plugin/server/create-mcp-tool-agent-class'
import { ChatContextOperator } from '@shared/utils/chat-context-helper/common/chat-context-operator'
import { settledPromiseResults } from '@shared/utils/common'

import { McpToState } from '../../mcp-to-state'
import type { McpToolWithConfigId } from '../../types'

export class McpToolsNode extends BaseNode {
  private allMcpTools: McpToolWithConfigId[] = []

  async onInit() {
    const mcpConfigs = await runAction(
      this.context.strategyOptions.registerManager
    ).server.mcp.getConfigsWithFullInfo({
      actionParams: {}
    })

    const allMcpTools: McpToolWithConfigId[] = []
    mcpConfigs.forEach(config => {
      allMcpTools.push(
        ...config.listTools.tools.map(tool => ({
          ...tool,
          configId: config.id
        }))
      )
    })
    this.allMcpTools = allMcpTools

    allMcpTools.forEach(tool => {
      const { configId, ...originalTool } = tool

      this.registerAgentConfig(tool.name, state => {
        const chatContextOp = new ChatContextOperator(state.chatContext)
        const lastConversationOp =
          chatContextOp.getLastAvailableConversationOperator()
        const mentionState = new McpToState(
          lastConversationOp?.get()
        ).toMentionsState()

        const { selectedMcpTools } = mentionState
        const targetTool = selectedMcpTools.find(
          selectedMcpTool =>
            selectedMcpTool.configId === configId &&
            selectedMcpTool.name === originalTool.name
        )

        const disabledAgent = !targetTool

        return this.createAgentConfig({
          disabledAgent,
          agentClass: createMcpToolAgentClass(configId, originalTool),
          agentContext: {
            state,
            strategyOptions: this.context.strategyOptions,
            createToolOptions: {}
          }
        })
      })
    })
  }

  async execute(state: ChatGraphState) {
    const agents: Agent[] = []

    await settledPromiseResults(
      this.allMcpTools.map(async tool => {
        const toolCallsResults = await this.executeAgentTool(
          'think',
          state,
          tool.name
        )

        if (!toolCallsResults.agents.length) return
        agents.push(...toolCallsResults.agents)
      })
    )

    if (!agents.length) return {}

    const newConversations = this.addAgentsToNewConversation(
      state.newConversations,
      agents
    )

    dispatchBaseGraphState({
      chatContext: state.chatContext,
      newConversations
    })

    return {
      chatContext: state.chatContext,
      newConversations
    }
  }
}
