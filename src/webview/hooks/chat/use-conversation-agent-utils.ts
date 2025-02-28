import type { Agent, Conversation } from '@shared/entities'
import {
  addOrUpdateAgents as addOrUpdateAgentsBase,
  type AgentPatchInput
} from '@shared/utils/chat-context-helper/common/agent-utils'
import { useChatContext } from '@webview/contexts/chat-context'
import { useAgentPluginIsSameAgent } from '@webview/contexts/plugin-context/use-agent-plugin'
import type { Updater } from 'use-immer'

export interface UseConversationAgentUtilsProps {
  conversation: Conversation
  setConversation: Updater<Conversation>
}

type AddOrUpdateAgentFn<T extends Agent = Agent> = (
  props: AgentPatchInput<T>
) => Promise<void>

type AddOrUpdateAgentsFn<
  InputAgents extends AgentPatchInput[] = AgentPatchInput[]
> = (props: InputAgents) => Promise<void>

export const useConversationAgentUtils = ({
  conversation,
  setConversation
}: UseConversationAgentUtilsProps) => {
  const isSameAgent = useAgentPluginIsSameAgent()
  const { saveSession } = useChatContext()

  const addOrUpdateAgent: AddOrUpdateAgentFn = async ({
    agent,
    relatedConversationContent,
    onApplySuccess
  }) => {
    if (!conversation || !setConversation) {
      throw new Error(
        'useConversationAgentUtils: Please provide conversation and setConversation'
      )
    }

    const result = addOrUpdateAgentsBase({
      conversation,
      setConversation,
      isSameAgent,
      inputAgents: [
        {
          agent,
          relatedConversationContent,
          onApplySuccess
        }
      ]
    })

    await saveSession(false)
    await result.runSuccessEvents()
  }

  const addOrUpdateAgents: AddOrUpdateAgentsFn = async inputAgents => {
    if (!conversation || !setConversation) {
      throw new Error(
        'useConversationAgentUtils: Please provide conversation and setConversation'
      )
    }

    const result = addOrUpdateAgentsBase({
      conversation,
      setConversation,
      isSameAgent,
      inputAgents
    })

    await saveSession(false)
    await result.runSuccessEvents()
  }

  return {
    addOrUpdateAgent,
    addOrUpdateAgents
  }
}
