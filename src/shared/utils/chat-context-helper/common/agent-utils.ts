import type { Agent, Conversation } from '@shared/entities'
import type { IsSameAgent } from '@shared/plugins/agents/_base/client/agent-client-plugin-types'
import type { MaybePromise } from '@shared/types/common'
import { settledPromiseResults } from '@shared/utils/common'
import type { Updater } from 'use-immer'
import { v4 as uuidv4 } from 'uuid'

export type AgentPatchType = 'add' | 'update'

export interface AgentPatchInput<T extends Agent = Agent> {
  agent: Omit<T, 'id' | 'weight'> & Partial<Pick<T, 'id' | 'weight'>>
  relatedConversationContent?: string // for calculate weight
  onApplySuccess?: (agentPatch: AgentPatch<T>) => MaybePromise<void>
}

export interface AgentPatch<T extends Agent = Agent> {
  conversationId: string
  agentIndex: number
  newAgent: T
  oldAgent: T | undefined
  type: AgentPatchType
  onApplySuccess?: (agentPatch: AgentPatch<T>) => MaybePromise<void>
}

export interface CreateAgentsPatchesProps<T extends Agent = Agent> {
  conversation: Conversation
  isSameAgent: IsSameAgent
  inputAgents: AgentPatchInput<T>[]
}

export const createAgentsPatches = <T extends Agent = Agent>({
  conversation,
  isSameAgent,
  inputAgents
}: CreateAgentsPatchesProps<T>) => {
  const results: AgentPatch<T>[] = []

  if (!conversation) return results

  // Pre-calculate text positions for relatedConversationContent lookup
  const textPositions = new Map<string, number>()
  let currentPosition = 0

  for (const content of conversation.contents) {
    if (content.type === 'text') {
      for (const { relatedConversationContent } of inputAgents) {
        if (
          relatedConversationContent &&
          !textPositions.has(relatedConversationContent) &&
          content.text.includes(relatedConversationContent)
        ) {
          textPositions.set(
            relatedConversationContent,
            currentPosition + content.text.indexOf(relatedConversationContent)
          )
        }
      }
      currentPosition += content.text.length
    } else {
      currentPosition += 1
    }
  }

  // Use Map to store unique agents with highest weights
  const uniqueAgentsMap = new Map<string, T>()

  for (const { agent, relatedConversationContent } of inputAgents) {
    const weight = relatedConversationContent
      ? (textPositions.get(relatedConversationContent) ?? Infinity)
      : (agent.weight ?? Infinity)

    const newAgent = {
      ...agent,
      id: agent.id || uuidv4(),
      weight
    } as T

    // Find if there's a similar agent already in the map
    let found = false
    for (const [key, existingAgent] of uniqueAgentsMap) {
      if (isSameAgent(newAgent, existingAgent)) {
        found = true
        if ((newAgent?.weight || 0) > (existingAgent?.weight || 0)) {
          uniqueAgentsMap.set(key, newAgent)
        }
        break
      }
    }

    if (!found) {
      uniqueAgentsMap.set(newAgent.id, newAgent)
    }
  }

  // Create patches by comparing with existing agents
  const existingAgentsMap = new Map<string, { agent: T; index: number }>()
  conversation.agents?.forEach((agent, index) => {
    existingAgentsMap.set(agent.id, { agent: agent as T, index })
  })

  for (const newAgent of uniqueAgentsMap.values()) {
    let found = false
    for (const { agent: existingAgent, index } of existingAgentsMap.values()) {
      if (isSameAgent(newAgent, existingAgent)) {
        found = true
        if ((newAgent?.weight || 0) > (existingAgent?.weight || 0)) {
          // Find the corresponding inputAgent for onApplySuccess
          const inputAgent = inputAgents.find(({ agent }) =>
            isSameAgent(newAgent, agent as T)
          )
          results.push({
            conversationId: conversation.id,
            agentIndex: index,
            newAgent,
            oldAgent: existingAgent,
            type: 'update',
            onApplySuccess: inputAgent?.onApplySuccess
          })
        }
        break
      }
    }

    if (!found) {
      // Find the corresponding inputAgent for onApplySuccess
      const inputAgent = inputAgents.find(({ agent }) =>
        isSameAgent(newAgent, agent as T)
      )
      results.push({
        conversationId: conversation.id,
        agentIndex: conversation.agents?.length || 0,
        newAgent,
        oldAgent: undefined,
        type: 'add',
        onApplySuccess: inputAgent?.onApplySuccess
      })
    }
  }

  return results
}

export interface ApplyAgentsPatchesProps<T extends Agent = Agent> {
  conversation: Conversation
  setConversation: Updater<Conversation>
  patches: AgentPatch<T>[]
}

export const applyAgentsPatches = <T extends Agent = Agent>({
  conversation,
  setConversation,
  patches
}: ApplyAgentsPatchesProps<T>) => {
  if (!conversation || !setConversation) {
    throw new Error(
      'applyAgentsPatches: Please provide conversation and setConversation'
    )
  }

  const events: (() => MaybePromise<void>)[] = []

  // Sort patches by index in descending order to avoid index shifting
  const sortedPatches = [...patches].sort((a, b) => b.agentIndex - a.agentIndex)

  setConversation(draft => {
    if (!draft.agents) draft.agents = []

    for (const patch of sortedPatches) {
      if (patch.type === 'add') {
        draft.agents.push(patch.newAgent)

        if (patch.onApplySuccess)
          events.push(() => patch.onApplySuccess!(patch))
      } else if (patch.type === 'update') {
        if (patch.agentIndex >= 0 && patch.agentIndex < draft.agents.length) {
          draft.agents[patch.agentIndex] = patch.newAgent

          if (patch.onApplySuccess)
            events.push(() => patch.onApplySuccess!(patch))
        }
      }
    }
  })

  return {
    runSuccessEvents: async () => {
      await settledPromiseResults(events.map(async event => await event()))
    }
  }
}

export interface AddOrUpdateAgentsProps<InputAgents extends AgentPatchInput[]> {
  conversation: Conversation
  setConversation: Updater<Conversation>
  isSameAgent: IsSameAgent
  inputAgents: InputAgents
}

export const addOrUpdateAgents = <InputAgents extends AgentPatchInput[]>({
  conversation,
  setConversation,
  isSameAgent,
  inputAgents
}: AddOrUpdateAgentsProps<InputAgents>) => {
  if (!conversation || !setConversation) {
    throw new Error(
      'addOrUpdateAgents: Please provide conversation and setConversation'
    )
  }

  // Create patches
  const patches = createAgentsPatches({
    conversation,
    isSameAgent,
    inputAgents
  })

  let runSuccessEvents: () => Promise<void> = async () => {}

  // Apply patches if any
  if (patches.length > 0) {
    const result = applyAgentsPatches({
      conversation,
      setConversation,
      patches
    })

    runSuccessEvents = result.runSuccessEvents
  }

  return {
    patches,
    runSuccessEvents
  }
}
