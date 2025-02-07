import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import { END, START, StateGraph } from '@langchain/langgraph'
import { ChatContextOperator } from '@shared/utils/chat-context-helper/common/chat-context-operator'

import type { BaseStrategyOptions } from '../_base/base-strategy'
import { combineNode } from '../../utils/combine-node'
import { AgentNode } from './nodes/agent-node'
import { GenerateNode } from './nodes/generate-node'
import {
  ComposerGraphNodeName,
  composerGraphState,
  type ComposerGraphState
} from './state'

const createSmartRoute =
  (nextNodeName: ComposerGraphNodeName) => (state: ComposerGraphState) => {
    if (state.abortController?.signal.aborted) {
      return END
    }

    // Check if any conversation is not frozen
    const chatContextOp = new ChatContextOperator(state.chatContext)
    const hasAvailableConversation =
      chatContextOp.getLastAvailableConversationOperator() !== null

    return hasAvailableConversation && state.shouldContinue ? nextNodeName : END
  }

export const createComposerWorkflow = async (options: BaseStrategyOptions) => {
  const composerStrategyProvider = options.registerManager
    .getRegister(ServerPluginRegister)
    ?.mentionServerPluginRegistry?.providerManagers.composerStrategy.mergeAll()

  const toolNodes =
    (await composerStrategyProvider?.buildLanggraphToolNodes?.(options)) || []

  const combinedToolsNode = combineNode(toolNodes, composerGraphState)

  const agentNode = new AgentNode({
    strategyOptions: options
  }).createGraphNode()

  const generateNode = new GenerateNode({
    strategyOptions: options
  }).createGraphNode()

  const composerWorkflow = new StateGraph(composerGraphState)
    .addNode(ComposerGraphNodeName.Agent, agentNode)
    .addNode(ComposerGraphNodeName.Tools, combinedToolsNode)
    .addNode(ComposerGraphNodeName.Generate, generateNode)

  composerWorkflow
    .addConditionalEdges(START, createSmartRoute(ComposerGraphNodeName.Agent))
    .addConditionalEdges(
      ComposerGraphNodeName.Agent,
      createSmartRoute(ComposerGraphNodeName.Tools)
    )
    .addConditionalEdges(
      ComposerGraphNodeName.Tools,
      createSmartRoute(ComposerGraphNodeName.Generate)
    )
    .addEdge(ComposerGraphNodeName.Generate, END)

  return composerWorkflow
}
