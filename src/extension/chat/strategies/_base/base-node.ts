/* eslint-disable new-cap */
import type {
  BaseGraphNode,
  BaseGraphState
} from '@extension/chat/strategies/_base/base-state'
import type { BaseStrategyOptions } from '@extension/chat/strategies/_base/base-strategy'
import { findCurrentToolsCallParams } from '@extension/chat/utils/find-current-tools-call-params'
import { logger } from '@extension/logger'
import type { ToolMessage } from '@langchain/core/messages'
import type { DynamicStructuredTool } from '@langchain/core/tools'
import type { Agent, Conversation } from '@shared/entities'
import type { ZodObjectAny } from '@shared/types/common'
import { ChatContextOperator } from '@shared/utils/chat-context-helper/common/chat-context-operator'
import { ConversationOperator } from '@shared/utils/chat-context-helper/common/conversation-operator'
import { settledPromiseResults } from '@shared/utils/common'
import { v4 as uuidv4 } from 'uuid'

import type { BaseAgent, GetAgentInput, GetAgentOutput } from './base-agent'

export interface BaseNodeContext<
  StrategyOptions extends BaseStrategyOptions = BaseStrategyOptions
> {
  strategyOptions: StrategyOptions
}

type AgentConstructor<T extends BaseAgent> = new (...args: any[]) => T

export type AgentConfig<T extends BaseAgent> = {
  disabledAgent?: boolean
  agentClass: AgentConstructor<T>
  agentContext?: T['context']
  processAgentOutput?: (agentOutput: GetAgentOutput<T>) => GetAgentOutput<T>
}

export type AgentsConfig = {
  [K: string]: AgentConfig<BaseAgent>
}

type ExecuteAgentToolResult<T extends BaseAgent> = {
  agents: Agent<GetAgentInput<T>, GetAgentOutput<T>>[]
}

type BuildAgentConfig<T extends BaseAgent, State extends BaseGraphState> = (
  state: State
) => AgentConfig<T>

export abstract class BaseNode<
  State extends BaseGraphState = BaseGraphState,
  StrategyOptions extends BaseStrategyOptions = BaseStrategyOptions
> {
  constructor(protected context: BaseNodeContext<StrategyOptions>) {
    this.onInit()
  }

  abstract onInit(): void

  protected agentNameBuildAgentConfigMap: Record<
    string,
    BuildAgentConfig<BaseAgent, State>
  > = {}

  protected createAgentConfig<T extends BaseAgent>(
    agentConfig: AgentConfig<T>
  ): AgentConfig<T> {
    return agentConfig
  }

  protected registerAgentConfig<T extends BaseAgent>(
    agentName: string,
    buildAgentConfig: BuildAgentConfig<T, State>
  ) {
    this.agentNameBuildAgentConfigMap[agentName] =
      buildAgentConfig as unknown as BuildAgentConfig<BaseAgent, State>
  }

  protected getAgentsConfig(state: State): AgentsConfig {
    return Object.fromEntries(
      Object.entries(this.agentNameBuildAgentConfigMap).reduce(
        (acc, [agentName, buildAgentConfig]) => {
          const agentConfig = buildAgentConfig(state)

          if (agentConfig.disabledAgent) return acc

          acc.push([agentName, agentConfig])
          return acc
        },
        [] as [string, AgentConfig<BaseAgent>][]
      )
    )
  }

  protected getAgentConfig<T extends BaseAgent>(
    agentName: string,
    state: State
  ): AgentConfig<T> | null {
    const config =
      (this.agentNameBuildAgentConfigMap[agentName]?.(
        state
      ) as unknown as AgentConfig<T>) || null

    if (!config || config.disabledAgent) return null

    return config
  }

  abstract execute(state: State): Promise<Partial<State>>

  protected async createAgentToolByName<T extends BaseAgent>(
    agentName: string,
    state: State,
    overrideAgentContext?: T['context']
  ): Promise<{
    tool: DynamicStructuredTool<ZodObjectAny> | null
    agentConfig: AgentConfig<T> | null
    agentInstance: T | null
  }> {
    const agentConfig = this.getAgentConfig<T>(agentName, state)

    if (!agentConfig)
      return { tool: null, agentConfig: null, agentInstance: null }

    const finalAgentContext = {
      ...agentConfig.agentContext,
      ...overrideAgentContext
    }

    if (
      !finalAgentContext.createToolOptions ||
      !finalAgentContext.state ||
      !finalAgentContext.strategyOptions
    ) {
      logger.error(
        'Agent context is missing required properties',
        finalAgentContext
      )
      throw new Error('Agent context is missing required properties')
    }

    const agentInstance = new agentConfig.agentClass(finalAgentContext)
    const tool = await agentInstance.createTool()
    return { tool, agentConfig, agentInstance }
  }

  // Helper method to execute tool calls
  protected async executeAgentTool<T extends BaseAgent>(
    state: State,
    props: AgentConfig<T>
  ): Promise<ExecuteAgentToolResult<T>> {
    const { agentClass: AgentClass, agentContext, processAgentOutput } = props

    const results: ExecuteAgentToolResult<T> = {
      agents: []
    }

    const { tool, agentConfig, agentInstance } =
      await this.createAgentToolByName(AgentClass.name, state, agentContext)

    if (!tool || !agentConfig || !agentInstance) return results

    const messages = agentConfig.agentContext?.state.messages || []

    if (!messages.length) return results

    const toolCalls = findCurrentToolsCallParams(messages.at(-1), [tool])

    if (!toolCalls.length) return results

    const toolCallsPromises = toolCalls.map(async toolCall => {
      const toolMessage = (await tool.invoke(toolCall)) as ToolMessage
      const agentOutput = JSON.parse(toolMessage?.lc_kwargs.content)

      const agent: Agent<GetAgentInput<T>, GetAgentOutput<T>> = {
        id: toolCall.id || uuidv4(),
        name: tool.name,
        input: toolCall.args,
        output: processAgentOutput
          ? processAgentOutput(agentOutput)
          : agentOutput
      }

      results.agents.push(agent)
    })

    await settledPromiseResults(toolCallsPromises)
    return results
  }

  // Helper method to add agent to conversation
  protected addAgentsToConversation<T extends BaseAgent>(
    conversation: Conversation,
    agents: Agent<GetAgentInput<T>, GetAgentOutput<T>>[]
  ): Conversation {
    const conversationOp = new ConversationOperator(conversation)
    return conversationOp.addAgents(agents)
  }

  protected addAgentsToLastHumanAndNewConversation<T extends BaseAgent>(
    state: State,
    agents: Agent<GetAgentInput<T>, GetAgentOutput<T>>[]
  ): State {
    const newState: State = { ...state }

    const chatContextOp = new ChatContextOperator(state.chatContext)
    chatContextOp.getLastAvailableHumanConversationOperator()?.addAgents(agents)

    const newConversation = state.newConversations.at(-1)!
    if (newConversation) {
      newState.newConversations[newState.newConversations.length - 1] =
        this.addAgentsToConversation(newConversation, agents)
    }
    newState.chatContext = chatContextOp.get()

    return newState
  }

  async createTools(
    state: State
  ): Promise<DynamicStructuredTool<ZodObjectAny>[]> {
    const agentsConfig = this.getAgentsConfig(state)
    const tools = await settledPromiseResults(
      Object.entries(agentsConfig).map(async ([_, agentConfig]) => {
        if (agentConfig.disabledAgent) return null

        const agentInstance = await new agentConfig.agentClass(
          agentConfig.agentContext
        )
        const tool = await agentInstance.createTool()
        return tool
      })
    )

    return tools.filter(Boolean) as DynamicStructuredTool<ZodObjectAny>[]
  }

  createGraphNode<T extends BaseGraphNode = BaseGraphNode>(): T {
    return ((state: State) => this.execute(state)) as T
  }
}

export const createToolsFromNodes = async <
  T extends BaseNode<any, any>,
  StrategyOptions extends BaseStrategyOptions = BaseStrategyOptions,
  State extends BaseGraphState = BaseGraphState
>(props: {
  nodeClasses: (new (...args: any[]) => T)[]
  state: State
  strategyOptions: StrategyOptions
}) =>
  (
    await Promise.all(
      props.nodeClasses.map(async NodeClass => {
        const nodeInstance = new NodeClass({
          strategyOptions: props.strategyOptions
        } as BaseNodeContext)
        return await nodeInstance.createTools(props.state)
      })
    )
  ).flat()

export const createGraphNodeFromNodes = async <
  T extends BaseNode<any, any>,
  StrategyOptions extends BaseStrategyOptions = BaseStrategyOptions
>(props: {
  nodeClasses: (new (...args: any[]) => T)[]
  strategyOptions: StrategyOptions
}) =>
  await Promise.all(
    props.nodeClasses.map(NodeClass =>
      new NodeClass({
        strategyOptions: props.strategyOptions
      } as BaseNodeContext).createGraphNode()
    )
  )
