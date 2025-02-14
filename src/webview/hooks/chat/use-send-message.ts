import { useRef } from 'react'
import type { Conversation } from '@shared/entities'
import { useChatContext } from '@webview/contexts/chat-context'
import { api } from '@webview/network/actions-api'
import { logger } from '@webview/utils/logger'

import { useChatState } from './use-chat-state'
import { useUpdateConversationAction } from './use-update-conversation-action'

export const useSendMessage = () => {
  const abortControllerRef = useRef<AbortController>(null)
  const { getContext, setContext, saveSession, setIsSending } = useChatContext()
  const {
    handleUIStateBeforeSend,
    handleConversationUpdate,
    handleUIStateAfterSend
  } = useChatState()
  const { updateConversationsActions } = useUpdateConversationAction()

  const sendMessage = async (conversation: Conversation) => {
    // Cancel previous request if exists
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    window.sessionIdSendMessageAbortControllerMap ||= {}
    window.sessionIdSendMessageAbortControllerMap[conversation.id] =
      abortControllerRef.current

    try {
      setIsSending(true)
      handleUIStateBeforeSend(conversation.id)
      await handleConversationUpdate(conversation)

      let localConversations: Conversation[] = []
      await api.actions().server.chat.streamChat(
        {
          actionParams: {
            chatContext: getContext()
          },
          abortController: abortControllerRef.current
        },
        (newConversations: Conversation[]) => {
          localConversations = newConversations

          setContext(draft => {
            draft.conversations = newConversations
          })

          handleUIStateBeforeSend(newConversations.at(-1)!.id)
        }
      )

      setContext(draft => {
        draft.conversations.forEach(conversation => {
          conversation.state.isGenerating = false
        })
      })

      const { runSuccessEvents } = updateConversationsActions({
        conversations: getContext().conversations,
        setChatContext: setContext
      })

      logger.verbose('Received conversations:', localConversations)

      await saveSession()
      await runSuccessEvents()

      // resetConversationInput(conversation.id)
    } finally {
      setIsSending(false)
      handleUIStateAfterSend()
    }
  }

  const cancelSending = async () => {
    const abortController =
      window.sessionIdSendMessageAbortControllerMap?.[getContext().id] ||
      abortControllerRef.current

    abortController?.abort()

    setIsSending(false)
    setContext(draft => {
      draft.conversations.forEach(conversation => {
        conversation.state.isGenerating = false
      })
    })
    await saveSession()
  }

  return {
    sendMessage,
    cancelSending
  }
}
