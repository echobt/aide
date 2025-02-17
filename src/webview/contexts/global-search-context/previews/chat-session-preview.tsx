import { useEffect, type FC } from 'react'
import type { ChatSession, Conversation } from '@shared/entities'
import { ChatMessages } from '@webview/components/chat/messages/chat-messages'
import { ChatWebPreviewProvider } from '@webview/components/chat/web-preview/chat-web-preview-context'
import { useChatContext } from '@webview/contexts/chat-context'
import { ChatProviders } from '@webview/contexts/providers'
import { useChatState } from '@webview/hooks/chat/use-chat-state'

const Core: FC<{ chatSession: ChatSession }> = ({ chatSession }) => {
  const { switchSession } = useChatContext()
  const { toggleConversationEditMode } = useChatState()

  useEffect(() => {
    switchSession(chatSession.id)
  }, [chatSession.id])

  const handleEditModeChange = (
    isEditMode: boolean,
    conversation: Conversation
  ) => {
    toggleConversationEditMode(conversation.id, isEditMode)
  }

  return (
    <ChatMessages
      onEditModeChange={handleEditModeChange}
      autoScrollToBottom={false}
      disableAnimation
    />
  )
}

export const ChatSessionPreview: React.FC<{
  chatSession: ChatSession
}> = ({ chatSession }) => (
  <ChatProviders>
    <ChatWebPreviewProvider value={{}}>
      <Core chatSession={chatSession} />
    </ChatWebPreviewProvider>
  </ChatProviders>
)
