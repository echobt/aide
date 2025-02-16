import { useRef, useTransition } from 'react'
import type { Conversation } from '@shared/entities'
import { useChatContext } from '@webview/contexts/chat-context'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { logger } from '@webview/utils/logger'

import { useChatState } from './use-chat-state'
import { useUpdateConversationAction } from './use-update-conversation-action'

export const useSendMessage = () => {
  const abortControllerRef = useRef<AbortController>(null)
  const { getContext, setContext, saveSession, setIsSending } = useChatContext()
  const [, startTransition] = useTransition()
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
      const getConversationsIdKey = (conversations: Conversation[]) =>
        conversations.map(conversation => conversation.id).join(',')
      let lastConversationsIdKey = ''

      await api.actions().server.chat.streamChat(
        {
          actionParams: {
            chatContext: getContext()
          },
          abortController: abortControllerRef.current
        },
        (newConversations: Conversation[]) => {
          localConversations = newConversations

          // Wrap state updates in startTransition
          startTransition(() => {
            setContext(draft => {
              draft.conversations = newConversations
            })

            const currentConversationsIdKey =
              getConversationsIdKey(newConversations)

            if (currentConversationsIdKey !== lastConversationsIdKey) {
              handleUIStateBeforeSend(newConversations.at(-1)!.id)
              lastConversationsIdKey = currentConversationsIdKey
            }
          })
        }
      )
      logger.verbose('Received conversations:', localConversations)
    } catch (error) {
      logAndToastError('AI request failed', error)
    } finally {
      startTransition(async () => {
        try {
          setContext(draft => {
            draft.conversations.forEach(conversation => {
              conversation.state.isGenerating = false
            })
          })

          const { runSuccessEvents } = updateConversationsActions({
            conversations: getContext().conversations,
            setChatContext: setContext
          })

          await saveSession(false)
          await runSuccessEvents()
          await saveSession()
          // resetConversationInput(conversation.id)
        } finally {
          setIsSending(false)
          handleUIStateAfterSend()
        }
      })
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
