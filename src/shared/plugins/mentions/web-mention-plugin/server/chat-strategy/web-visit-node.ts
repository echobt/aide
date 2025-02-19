import {
  BaseNode,
  dispatchBaseGraphState,
  type ChatGraphState
} from '@shared/plugins/_shared/strategies'
import { WebVisitAgent } from '@shared/plugins/agents/web-visit-agent-plugin/server/web-visit-agent'
import { ChatContextOperator } from '@shared/utils/chat-context-helper/common/chat-context-operator'

import { WebToState } from '../../web-to-state'

export class WebVisitNode extends BaseNode {
  onInit() {
    this.registerAgentConfig(WebVisitAgent.name, state => {
      const chatContextOp = new ChatContextOperator(state.chatContext)
      const lastConversationOp =
        chatContextOp.getLastAvailableConversationOperator()
      const mentionState = new WebToState(
        lastConversationOp?.get()
      ).toMentionsState()
      const disabledAgent = !mentionState.enableWebVisitAgent

      return this.createAgentConfig({
        disabledAgent,
        agentClass: WebVisitAgent,
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
        agentClass: WebVisitAgent
      },
      agent => Boolean(agent.output.visitResults.length)
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
