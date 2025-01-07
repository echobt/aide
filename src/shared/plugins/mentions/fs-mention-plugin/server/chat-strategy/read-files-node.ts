import {
  BaseNode,
  dispatchBaseGraphState,
  type ChatGraphState
} from '@shared/plugins/_shared/strategies'
import { ReadFilesAgent } from '@shared/plugins/agents/read-files-agent-plugin/server/read-files-agent'

export class ReadFilesNode extends BaseNode {
  onInit() {
    this.registerAgentConfig(ReadFilesAgent.name, state =>
      this.createAgentConfig({
        agentClass: ReadFilesAgent,
        agentContext: {
          state,
          strategyOptions: this.context.strategyOptions,
          createToolOptions: {}
        }
      })
    )
  }

  async execute(state: ChatGraphState) {
    const toolCallsResults = await this.executeAgentTool(state, {
      agentClass: ReadFilesAgent
    })

    if (!toolCallsResults.agents.length) return {}

    this.addAgentsToLastHumanAndNewConversation(state, toolCallsResults.agents)

    dispatchBaseGraphState({
      chatContext: state.chatContext,
      newConversations: state.newConversations
    })

    return {
      chatContext: state.chatContext,
      newConversations: state.newConversations
    }
  }
}
