import type { Conversation } from '@shared/entities'
import { useChatContext } from '@webview/contexts/chat-context'
import { api } from '@webview/network/actions-api'

export const useWorkspaceCheckpoint = (
  currentConversation: Conversation,
  workspaceCheckpointHash?: string
) => {
  const { context, setContext, saveSession } = useChatContext()
  const { conversations } = context

  // 1. Find the index of currentConversation in conversations
  const currentConIndex = conversations.findIndex(
    c => c.id === currentConversation.id
  )

  // 2. Retrieve workspaceCheckpointHash directly from currentConversation
  const directHash = currentConversation.agents?.find(
    agent => agent.workspaceCheckpointHash
  )?.workspaceCheckpointHash

  // 3. If not found and the role is 'human', find the first 'ai' conversation after it
  let fallbackHash: string | undefined
  if (
    !directHash &&
    currentConversation.role === 'human' &&
    currentConIndex !== -1
  ) {
    fallbackHash = conversations
      .slice(currentConIndex + 1)
      .find(conv => conv.role === 'ai')
      ?.agents?.find(
        agent => agent.workspaceCheckpointHash
      )?.workspaceCheckpointHash
  }

  // 4. Final workspaceCheckpointHash to use
  const currentWorkspaceCheckpointHash =
    workspaceCheckpointHash ?? directHash ?? fallbackHash

  // 5. Method to clear workspaceCheckpointHash from all subsequent actions
  const restoreWorkspaceCheckpoint = async () => {
    if (!currentWorkspaceCheckpointHash) return

    await api.actions().server.workspaceCheckpoint.restoreCheckpoint({
      actionParams: {
        commitHash: currentWorkspaceCheckpointHash
      }
    })

    setContext(draft => {
      // If there's nothing to clear, just return

      let foundConIndex = -1
      let foundAgentIndex = -1

      // --- (A) Find where the currentWorkspaceCheckpointHash first appears ---
      for (let ci = 0; ci < draft.conversations.length; ci++) {
        const conversation = draft.conversations[ci]
        if (!conversation || !conversation.agents?.length) continue
        for (let ai = 0; ai < conversation.agents.length; ai++) {
          if (
            conversation.agents[ai]?.workspaceCheckpointHash ===
            currentWorkspaceCheckpointHash
          ) {
            foundConIndex = ci
            foundAgentIndex = ai
            break
          }
        }
      }

      // If we didn't find any matching hash, no cleanup is needed
      if (foundConIndex === -1 || foundAgentIndex === -1) return

      // --- (B) Clear workspaceCheckpointHash in the found conversation ---
      // Clear from the agent right after foundAgentIndex
      for (
        let agentIndex = foundAgentIndex;
        agentIndex < draft.conversations[foundConIndex]!.agents!.length;
        agentIndex++
      ) {
        draft.conversations[foundConIndex]!.agents![
          agentIndex
        ]!.workspaceCheckpointHash = undefined
      }

      // --- (C) Clear workspaceCheckpointHash in all subsequent conversations ---
      for (let ci = foundConIndex + 1; ci < draft.conversations.length; ci++) {
        const conversation = draft.conversations[ci]
        conversation?.agents?.forEach(agent => {
          agent.workspaceCheckpointHash = undefined
        })
      }
    })

    await saveSession()
  }

  return {
    currentWorkspaceCheckpointHash,
    restoreWorkspaceCheckpoint
  }
}
