import {
  BaseNode,
  ChatGraphState,
  dispatchBaseGraphState,
  type BaseStrategyOptions
} from '@shared/plugins/_shared/strategies'
import { DocRetrieverAgent } from '@shared/plugins/agents/doc-retriever-agent-plugin/server/doc-retriever-agent'

import { DocToState } from '../../doc-to-state'

export class DocRetrieverNode extends BaseNode<
  ChatGraphState,
  BaseStrategyOptions
> {
  onInit() {
    this.registerAgentConfig(DocRetrieverAgent.name, state => {
      const lastConversation = state.chatContext.conversations.at(-1)
      const mentionState = new DocToState(lastConversation).toMentionsState()

      return this.createAgentConfig({
        agentClass: DocRetrieverAgent,
        agentContext: {
          state,
          strategyOptions: this.context.strategyOptions,
          createToolOptions: {
            allowSearchDocSiteNames: mentionState.allowSearchDocSiteNames
          }
        }
      })
    })
  }

  async execute(state: ChatGraphState) {
    const toolCallsResults = await this.executeAgentTool(state, {
      agentClass: DocRetrieverAgent
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
