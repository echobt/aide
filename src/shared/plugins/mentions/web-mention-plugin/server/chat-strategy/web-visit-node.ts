import {
  BaseNode,
  dispatchBaseGraphState,
  type ChatGraphState
} from '@shared/plugins/_shared/strategies'
import { WebVisitAgent } from '@shared/plugins/agents/web-visit-agent-plugin/server/web-visit-agent'

import { WebToState } from '../../web-to-state'

export class WebVisitNode extends BaseNode {
  onInit() {
    this.registerAgentConfig(WebVisitAgent.name, state => {
      const lastConversation = state.chatContext.conversations.at(-1)
      const mentionState = new WebToState(lastConversation).toMentionsState()

      return this.createAgentConfig({
        agentClass: WebVisitAgent,
        agentContext: {
          state,
          strategyOptions: this.context.strategyOptions,
          createToolOptions: {
            enableWebVisitAgent: mentionState.enableWebVisitAgent
          }
        }
      })
    })
  }

  async execute(state: ChatGraphState) {
    const toolCallsResults = await this.executeAgentTool(state, {
      agentClass: WebVisitAgent
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
