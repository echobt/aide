import type { StructuredTool } from '@langchain/core/tools'
import type { Conversation } from '@shared/entities'
import {
  createGraphNodeFromNodes,
  createToolsFromNodes
} from '@shared/plugins/_shared/strategies'
import type {
  BaseStrategyOptions,
  ChatGraphNode,
  ChatGraphState
} from '@shared/plugins/_shared/strategies'
import type {
  GetAgentState,
  GetMentionState
} from '@shared/plugins/mentions/_base/base-to-state'
import type { MentionChatStrategyProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'

import { McpToState } from '../../mcp-to-state'
import { McpToolsNode } from './mcp-tools-node'

interface ConversationWithStateProps {
  conversation: Conversation
  mentionState: GetMentionState<McpToState>
  agentState: GetAgentState<McpToState>
}

export class McpMentionChatStrategyProvider
  implements MentionChatStrategyProvider
{
  private createConversationWithStateProps(
    conversation: Conversation
  ): ConversationWithStateProps {
    const mcpToState = new McpToState(conversation)
    const mentionState = mcpToState.toMentionsState()
    const agentState = mcpToState.toAgentsState()

    return { conversation, mentionState, agentState }
  }

  async buildContextMessagePrompt(conversation: Conversation): Promise<string> {
    const props = this.createConversationWithStateProps(conversation)
    const mcpToolsCallResultsPrompt = this.buildMcpToolsCallResultsPrompt(props)
    const prompts = [mcpToolsCallResultsPrompt].filter(Boolean)

    return prompts.join('\n\n')
  }

  async buildHumanMessagePrompt(conversation: Conversation): Promise<string> {
    const props = this.createConversationWithStateProps(conversation)
    const mcpSelectedPromptsPrompt = this.buildMcpSelectedPromptsPrompt(props)
    const prompts = [mcpSelectedPromptsPrompt].filter(Boolean)

    return prompts.join('\n\n')
  }

  async buildAgentTools(
    strategyOptions: BaseStrategyOptions,
    state: ChatGraphState
  ): Promise<StructuredTool[]> {
    return await createToolsFromNodes({
      nodeClasses: [McpToolsNode],
      strategyOptions,
      state
    })
  }

  async buildLanggraphToolNodes(
    strategyOptions: BaseStrategyOptions
  ): Promise<ChatGraphNode[]> {
    return await createGraphNodeFromNodes({
      nodeClasses: [McpToolsNode],
      strategyOptions
    })
  }

  private buildMcpToolsCallResultsPrompt(
    props: ConversationWithStateProps
  ): string {
    const { agentState } = props
    const { mcpToolsCallAgents } = agentState

    if (!mcpToolsCallAgents?.length) return ''

    let mcpToolsCallResultsContent = 'You have called the following tools:\n\n'

    mcpToolsCallAgents.forEach(mcpToolsCallAgent => {
      mcpToolsCallResultsContent += `
Tool Name: ${mcpToolsCallAgent.name}
Tool Parameters: ${JSON.stringify(mcpToolsCallAgent.input, null, 2)}
Tool Result: ${JSON.stringify(mcpToolsCallAgent.output, null, 2)}
`
    })

    return mcpToolsCallResultsContent
      ? `
## Potentially Relevant Tools

${mcpToolsCallResultsContent}
${CONTENT_SEPARATOR}
`
      : ''
  }

  private buildMcpSelectedPromptsPrompt(
    props: ConversationWithStateProps
  ): string {
    const { mentionState } = props
    const { selectedMcpPrompts } = mentionState

    if (!selectedMcpPrompts?.length) return ''

    let mcpSelectedPromptsContent =
      'By the way, please follow the following prompts:\n\n'

    selectedMcpPrompts.forEach(mcpSelectedPrompt => {
      mcpSelectedPromptsContent += mcpSelectedPrompt.description
    })

    return mcpSelectedPromptsContent
      ? `
## Potentially Relevant Prompts

${mcpSelectedPromptsContent}
${CONTENT_SEPARATOR}
`
      : ''
  }
}

const CONTENT_SEPARATOR = `


-------



-------


`
