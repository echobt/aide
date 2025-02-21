import { useEffect, type FC } from 'react'
import type { Conversation } from '@shared/entities'
import { ChatMessages } from '@webview/components/chat/messages/chat-messages'
import { ChatWebPreviewProvider } from '@webview/components/chat/web-preview/chat-web-preview-context'
import { useChatContext } from '@webview/contexts/chat-context'
import { ChatProviders } from '@webview/contexts/providers'
import { useChatState } from '@webview/hooks/chat/use-chat-state'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'

const Core: FC<{ sessionId: string }> = ({ sessionId }) => {
  const { context, setContext } = useChatContext()
  const { toggleConversationEditMode } = useChatState()
  const handleEditModeChange = (
    isEditMode: boolean,
    conversation: Conversation
  ) => {
    toggleConversationEditMode(conversation.id, isEditMode)
  }

  const contextId = context?.id
  useEffect(() => {
    if (!sessionId) return

    const loadSession = async () => {
      try {
        if (contextId === sessionId) return
        const fullChatContext = await api
          .actions()
          .server.chatSession.getChatContext({
            actionParams: { sessionId }
          })
        if (!fullChatContext) throw new Error('Chat context not found')
        setContext(fullChatContext)
      } catch (error) {
        logAndToastError(`Failed to switch to session ${sessionId}`, error)
      }
    }

    loadSession()
  }, [sessionId, contextId])

  if (!context) return null

  return (
    <ChatMessages
      onEditModeChange={handleEditModeChange}
      autoScrollToBottom={false}
      disableAnimation
    />
  )
}

export const ChatSessionPreview: React.FC<{
  sessionId: string
}> = ({ sessionId }) => (
  <ChatProviders disableEffect>
    <ChatWebPreviewProvider value={{}}>
      <Core sessionId={sessionId} />
    </ChatWebPreviewProvider>
  </ChatProviders>
)
