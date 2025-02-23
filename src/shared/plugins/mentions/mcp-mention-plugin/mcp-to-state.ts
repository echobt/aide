import { BaseToState } from '../_base/base-to-state'
import { McpMentionType, type McpMention } from './types'

export class McpToState extends BaseToState<McpMention> {
  toMentionsState() {
    return {
      selectedMcpTools: this.getMentionDataByType(McpMentionType.McpTool),
      selectedMcpPrompts: this.getMentionDataByType(McpMentionType.McpPrompt)
    }
  }

  toAgentsState() {
    return {
      mcpToolsCallAgents: this.agents
    }
  }
}
