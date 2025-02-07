import {
  BaseNode,
  dispatchBaseGraphState,
  type ChatGraphState
} from '@shared/plugins/_shared/strategies'
import { DocRetrieverAgent } from '@shared/plugins/agents/doc-retriever-agent-plugin/server/doc-retriever-agent'
import { ChatContextOperator } from '@shared/utils/chat-context-helper/common/chat-context-operator'

import { DocToState } from '../../doc-to-state'

export class DocRetrieverNode extends BaseNode {
  onInit() {
    this.registerAgentConfig(DocRetrieverAgent.name, state => {
      const chatContextOp = new ChatContextOperator(state.chatContext)
      const lastConversationOp =
        chatContextOp.getLastAvailableConversationOperator()
      const mentionState = new DocToState(
        lastConversationOp?.get()
      ).toMentionsState()

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
