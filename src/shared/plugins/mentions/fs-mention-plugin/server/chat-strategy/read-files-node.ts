import {
  BaseNode,
  dispatchBaseGraphState,
  type ChatGraphState
} from '@shared/plugins/_shared/strategies'
import { ReadFilesAgent } from '@shared/plugins/agents/read-files-agent-plugin/server/read-files-agent'
import { ChatContextOperator } from '@shared/utils/chat-context-helper/common/chat-context-operator'

import { FsToState } from '../../fs-to-state'

export class ReadFilesNode extends BaseNode {
  onInit() {
    this.registerAgentConfig(ReadFilesAgent.name, state => {
      const chatContextOp = new ChatContextOperator(state.chatContext)
      const lastConversationOp =
        chatContextOp.getLastAvailableConversationOperator()
      const mentionState = new FsToState(
        lastConversationOp?.get()
      ).toMentionsState()
      const disabledAgent = !mentionState.enableReadFilesAgent

      return this.createAgentConfig({
        agentClass: ReadFilesAgent,
        disabledAgent,
        agentContext: {
          state,
          strategyOptions: this.context.strategyOptions,
          createToolOptions: {}
        }
      })
    })
  }

  async execute(state: ChatGraphState) {
    const toolCallsResults = await this.executeAgentTool(
      'think',
      state,
      {
        agentClass: ReadFilesAgent
      },
      agent => Boolean(agent.output.codeSnippets.length)
    )

    if (!toolCallsResults.agents.length) return {}

    const newConversations = this.addAgentsToNewConversation(
      state.newConversations,
      toolCallsResults.agents
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
