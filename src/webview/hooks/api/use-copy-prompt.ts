import type { Conversation } from '@shared/entities'
import { useMutation } from '@tanstack/react-query'
import { useChatContext } from '@webview/contexts/chat-context'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { produce } from 'immer'

export const useCopyPrompt = () => {
  const { context } = useChatContext()

  const copyPromptMutation = useMutation({
    mutationFn: async (conversation: Conversation) => {
      await api.actions().server.chat.copyPrompt({
        actionParams: {
          type: 'finalConversation',
          chatContext: produce(context, draft => {
            const conversationIndex = context.conversations.findIndex(
              c => c.id === conversation.id
            )
            if (conversationIndex !== -1) {
              draft.conversations = context.conversations.slice(
                0,
                conversationIndex
              )
            }
            draft.conversations.push(conversation)
          })
        }
      })
    },
    onError: (error: Error) => {
      logAndToastError('Failed to copy prompt', error)
    }
  })

  return copyPromptMutation
}
