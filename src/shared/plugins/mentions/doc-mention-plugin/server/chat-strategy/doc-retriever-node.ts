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
      const { allowSearchDocSiteNames } = mentionState
      const disabledAgent = !allowSearchDocSiteNames.length

      return this.createAgentConfig({
        disabledAgent,
        agentClass: DocRetrieverAgent,
        agentContext: {
          state,
          strategyOptions: this.context.strategyOptions,
          createToolOptions: {
            allowSearchDocSiteNames
          }
        }
      })
    })
  }

  async execute(state: ChatGraphState) {
    const toolCallsResults = await this.executeAgentTool(
      state,
      {
        agentClass: DocRetrieverAgent
      },
      agent => Boolean(agent.output.relevantDocs.length)
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
