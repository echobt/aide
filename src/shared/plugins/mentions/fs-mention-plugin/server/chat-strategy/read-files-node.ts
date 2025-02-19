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
    const toolCallsResults = await this.executeAgentTool(
      state,
      {
        agentClass: ReadFilesAgent
      },
      agent => Boolean(agent.output.codeSnippets.length)
    )

    if (!toolCallsResults.agents.length) return {}

    const newState = this.addAgentsToLastHumanAndNewConversation(
      state,
      toolCallsResults.agents
    )

    dispatchBaseGraphState({
      chatContext: newState.chatContext,
      newConversations: newState.newConversations
    })

    return {
      chatContext: newState.chatContext,
      newConversations: newState.newConversations
    }
  }
}
