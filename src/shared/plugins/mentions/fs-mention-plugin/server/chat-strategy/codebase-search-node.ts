import {
  BaseNode,
  dispatchBaseGraphState,
  type ChatGraphState
} from '@shared/plugins/_shared/strategies'
import { CodebaseSearchAgent } from '@shared/plugins/agents/codebase-search-agent-plugin/server/codebase-search-agent'
import { ChatContextOperator } from '@shared/utils/chat-context-helper/common/chat-context-operator'

import { FsToState } from '../../fs-to-state'

export class CodebaseSearchNode extends BaseNode {
  onInit() {
    this.registerAgentConfig(CodebaseSearchAgent.name, state => {
      const chatContextOp = new ChatContextOperator(state.chatContext)
      const lastConversationOp =
        chatContextOp.getLastAvailableConversationOperator()
      const mentionState = new FsToState(
        lastConversationOp?.get()
      ).toMentionsState()
      const disabledAgent = !mentionState.enableCodebaseAgent

      return this.createAgentConfig({
        disabledAgent,
        agentClass: CodebaseSearchAgent,
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
        agentClass: CodebaseSearchAgent
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
