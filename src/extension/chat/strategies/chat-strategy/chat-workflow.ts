import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { END, START, StateGraph } from '@langchain/langgraph'

import type { BaseStrategyOptions } from '../_base/base-strategy'
import { combineNode } from '../../utils/combine-node'
import { AgentNode } from './nodes/agent-node'
import { GenerateNode } from './nodes/generate-node'
import { ChatGraphNodeName, chatGraphState, type ChatGraphState } from './state'

const createSmartRoute =
  (nextNodeName: ChatGraphNodeName) => (state: ChatGraphState) => {
    if (state.abortController?.signal.aborted) {
      return END
    }

    return state.shouldContinue ? nextNodeName : END
  }

export const createChatWorkflow = async (options: BaseStrategyOptions) => {
  const chatStrategyProvider = options.registerManager
    .getRegister(ServerPluginRegister)
    ?.mentionServerPluginRegistry?.providerManagers.chatStrategy.mergeAll()

  const toolNodes =
    (await chatStrategyProvider?.buildLanggraphToolNodes?.(options)) || []

  const combinedToolsNode = combineNode(toolNodes, chatGraphState)

  const agentNode = new AgentNode({
    strategyOptions: options
  }).createGraphNode()

  const generateNode = new GenerateNode({
    strategyOptions: options
  }).createGraphNode()

  const chatWorkflow = new StateGraph(chatGraphState)
    .addNode(ChatGraphNodeName.Agent, agentNode)
    .addNode(ChatGraphNodeName.Tools, combinedToolsNode)
    .addNode(ChatGraphNodeName.Generate, generateNode)

  chatWorkflow
    .addConditionalEdges(START, createSmartRoute(ChatGraphNodeName.Agent))
    .addConditionalEdges(
      ChatGraphNodeName.Agent,
      createSmartRoute(ChatGraphNodeName.Tools)
    )
    .addConditionalEdges(
      ChatGraphNodeName.Tools,
      createSmartRoute(ChatGraphNodeName.Generate)
    )
    .addEdge(ChatGraphNodeName.Generate, END)

  return chatWorkflow
}
