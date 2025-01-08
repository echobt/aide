import type {
  BaseAgent,
  GetAgentOutput
} from '@extension/chat/strategies/_base/base-agent'
import type { Agent, Conversation, Mention } from '@shared/entities'

export abstract class BaseToState<M extends Mention> {
  mentions?: M[]

  agents?: Agent[]

  conversation?: Conversation

  constructor(conversation?: Conversation) {
    this.mentions = (conversation?.mentions || []) as M[]
    this.agents = (conversation?.thinkAgents || []) as Agent[]
    this.conversation = conversation
  }

  abstract toMentionsState(): unknown

  abstract toAgentsState(): unknown

  getMentionDataByType<T extends string>(
    type: T
  ): Extract<M, { type: T }>['data'][] {
    if (!this.mentions?.length) return []
    const data: Mention['data'][] = []

    this.mentions?.forEach(mention => {
      if (mention.type === type && mention.data) {
        data.push(mention.data)
      }
    })

    return data
  }

  isMentionExit<T extends string>(type: T): boolean {
    if (!this.mentions?.length) return false
    return this.mentions?.some(mention => mention.type === type) || false
  }

  getAgentOutputs<T extends BaseAgent>(
    agentName: T['name']
  ): GetAgentOutput<T>[] {
    const outputs: GetAgentOutput<T>[] = []

    this.agents?.forEach(agent => {
      if (agent.name === agentName && agent.output) {
        outputs.push(agent.output)
      }
    })

    return outputs
  }

  getAgentOutputsByKey<T extends BaseAgent, K extends keyof GetAgentOutput<T>>(
    agentName: T['name'],
    key: K
  ): GetAgentOutput<T>[K][] {
    const outputs: GetAgentOutput<T>[K][] = []

    this.agents?.forEach(agent => {
      if (
        agent.name === agentName &&
        agent.output &&
        key in agent.output &&
        agent.output[key]
      ) {
        outputs.push(agent.output[key])
      }
    })

    return outputs
  }
}

export type GetMentionState<T extends BaseToState<any>> = ReturnType<
  T['toMentionsState']
>

export type GetAgentState<T extends BaseToState<any>> = ReturnType<
  T['toAgentsState']
>
