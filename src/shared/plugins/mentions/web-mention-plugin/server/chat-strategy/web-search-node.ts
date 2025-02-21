import {
  BaseNode,
  dispatchBaseGraphState,
  type ChatGraphState
} from '@shared/plugins/_shared/strategies'
import { WebSearchAgent } from '@shared/plugins/agents/web-search-agent-plugin/server/web-search-agent'
import { ChatContextOperator } from '@shared/utils/chat-context-helper/common/chat-context-operator'

import { WebToState } from '../../web-to-state'

export class WebSearchNode extends BaseNode {
  onInit() {
    this.registerAgentConfig(WebSearchAgent.name, state => {
      const chatContextOp = new ChatContextOperator(state.chatContext)
      const lastConversationOp =
        chatContextOp.getLastAvailableConversationOperator()
      const mentionState = new WebToState(
        lastConversationOp?.get()
      ).toMentionsState()
      const disabledAgent = !mentionState.enableWebSearchAgent

      return this.createAgentConfig({
        disabledAgent,
        agentClass: WebSearchAgent,
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
      state,
      {
        agentClass: WebSearchAgent
      },
      agent => Boolean(agent.output.searchResults.length)
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
