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
  const directHash = currentConversation.actions.find(
    action => action.workspaceCheckpointHash
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
      ?.actions.find(
        action => action.workspaceCheckpointHash
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
      let foundActIndex = -1

      // --- (A) Find where the currentWorkspaceCheckpointHash first appears ---
      for (let ci = 0; ci < draft.conversations.length; ci++) {
        const conversation = draft.conversations[ci]
        if (!conversation) continue
        for (let ai = 0; ai < conversation.actions.length; ai++) {
          if (
            conversation.actions[ai]?.workspaceCheckpointHash ===
            currentWorkspaceCheckpointHash
          ) {
            foundConIndex = ci
            foundActIndex = ai
            break
          }
        }
      }

      // If we didn't find any matching hash, no cleanup is needed
      if (foundConIndex === -1 || foundActIndex === -1) return

      // --- (B) Clear workspaceCheckpointHash in the found conversation ---
      // Clear from the action right after foundActIndex
      for (
        let actionIndex = foundActIndex;
        actionIndex < draft.conversations[foundConIndex]!.actions.length;
        actionIndex++
      ) {
        draft.conversations[foundConIndex]!.actions[
          actionIndex
        ]!.workspaceCheckpointHash = undefined
      }

      // --- (C) Clear workspaceCheckpointHash in all subsequent conversations ---
      for (let ci = foundConIndex + 1; ci < draft.conversations.length; ci++) {
        const conversation = draft.conversations[ci]
        conversation?.actions.forEach(action => {
          action.workspaceCheckpointHash = undefined
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
