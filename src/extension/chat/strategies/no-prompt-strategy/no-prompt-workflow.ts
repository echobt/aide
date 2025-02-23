import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { END, START, StateGraph } from '@langchain/langgraph'
import { ChatContextOperator } from '@shared/utils/chat-context-helper/common/chat-context-operator'

import type { BaseStrategyOptions } from '../_base/base-strategy'
import { combineNode } from '../../utils/combine-node'
import { AgentNode } from './nodes/agent-node'
import { GenerateNode } from './nodes/generate-node'
import {
  NoPromptGraphNodeName,
  noPromptGraphState,
  type NoPromptGraphState
} from './state'

const createSmartRoute =
  (nextNodeName: NoPromptGraphNodeName) => (state: NoPromptGraphState) => {
    if (state.abortController?.signal.aborted) {
      return END
    }

    // Check if any conversation is not frozen
    const chatContextOp = new ChatContextOperator(state.chatContext)
    const hasAvailableConversation =
      chatContextOp.getLastAvailableConversationOperator() !== null

    return hasAvailableConversation && state.shouldContinue ? nextNodeName : END
  }

export const createNoPromptWorkflow = async (options: BaseStrategyOptions) => {
  const noPromptStrategyProvider = options.registerManager
    .getRegister(ServerPluginRegister)
    ?.mentionServerPluginRegistry?.providerManagers.noPromptStrategy.mergeAll()

  const toolNodes =
    (await noPromptStrategyProvider?.buildLanggraphToolNodes?.(options)) || []

  const combinedToolsNode = combineNode(toolNodes, noPromptGraphState)

  const agentNode = new AgentNode({
    strategyOptions: options
  }).createGraphNode()

  const generateNode = new GenerateNode({
    strategyOptions: options
  }).createGraphNode()

  const noPromptWorkflow = new StateGraph(noPromptGraphState)
    .addNode(NoPromptGraphNodeName.Agent, agentNode)
    .addNode(NoPromptGraphNodeName.Tools, combinedToolsNode)
    .addNode(NoPromptGraphNodeName.Generate, generateNode)

  noPromptWorkflow
    .addConditionalEdges(START, createSmartRoute(NoPromptGraphNodeName.Agent))
    .addConditionalEdges(
      NoPromptGraphNodeName.Agent,
      createSmartRoute(NoPromptGraphNodeName.Tools)
    )
    .addConditionalEdges(
      NoPromptGraphNodeName.Tools,
      createSmartRoute(NoPromptGraphNodeName.Generate)
    )
    .addEdge(NoPromptGraphNodeName.Generate, END)

  return noPromptWorkflow
}
