import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { END, START, StateGraph } from '@langchain/langgraph'
import { ChatContextOperator } from '@shared/utils/chat-context-helper/common/chat-context-operator'

import type { BaseStrategyOptions } from '../_base/base-strategy'
import { combineNode } from '../../utils/combine-node'
import { AgentNode } from './nodes/agent-node'
import { GenerateNode } from './nodes/generate-node'
import { V1GraphNodeName, v1GraphState, type V1GraphState } from './state'

const createSmartRoute =
  (nextNodeName: V1GraphNodeName) => (state: V1GraphState) => {
    if (state.abortController?.signal.aborted) {
      return END
    }

    // Check if any conversation is not frozen
    const chatContextOp = new ChatContextOperator(state.chatContext)
    const hasAvailableConversation =
      chatContextOp.getLastAvailableConversationOperator() !== null

    return hasAvailableConversation && state.shouldContinue ? nextNodeName : END
  }

export const createV1Workflow = async (options: BaseStrategyOptions) => {
  const chatStrategyProvider = options.registerManager
    .getRegister(ServerPluginRegister)
    ?.mentionServerPluginRegistry?.providerManagers.chatStrategy.mergeAll()

  const toolNodes =
    (await chatStrategyProvider?.buildLanggraphToolNodes?.(options)) || []

  const combinedToolsNode = combineNode(toolNodes, v1GraphState)

  const agentNode = new AgentNode({
    strategyOptions: options
  }).createGraphNode()

  const generateNode = new GenerateNode({
    strategyOptions: options
  }).createGraphNode()

  const v1Workflow = new StateGraph(v1GraphState)
    .addNode(V1GraphNodeName.Agent, agentNode)
    .addNode(V1GraphNodeName.Tools, combinedToolsNode)
    .addNode(V1GraphNodeName.Generate, generateNode)

  v1Workflow
    .addConditionalEdges(START, createSmartRoute(V1GraphNodeName.Agent))
    .addConditionalEdges(
      V1GraphNodeName.Agent,
      createSmartRoute(V1GraphNodeName.Tools)
    )
    .addConditionalEdges(
      V1GraphNodeName.Tools,
      createSmartRoute(V1GraphNodeName.Generate)
    )
    .addEdge(V1GraphNodeName.Generate, END)

  return v1Workflow
}
