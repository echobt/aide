import {
  BaseNode,
  dispatchBaseGraphState,
  type ChatGraphState
} from '@shared/plugins/_shared/strategies'
import { CodebaseSearchAgent } from '@shared/plugins/agents/codebase-search-agent-plugin/server/codebase-search-agent'

import { FsToState } from '../../fs-to-state'

export class CodebaseSearchNode extends BaseNode {
  onInit() {
    this.registerAgentConfig(CodebaseSearchAgent.name, state => {
      const lastConversation = state.chatContext.conversations.at(-1)
      const mentionState = new FsToState(lastConversation).toMentionsState()

      return this.createAgentConfig({
        agentClass: CodebaseSearchAgent,
        agentContext: {
          state,
          strategyOptions: this.context.strategyOptions,
          createToolOptions: {
            enableCodebaseAgent: mentionState.enableCodebaseAgent
          }
        }
      })
    })
  }

  async execute(state: ChatGraphState) {
    const toolCallsResults = await this.executeAgentTool(state, {
      agentClass: CodebaseSearchAgent
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
