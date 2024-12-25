import React, { createContext, FC, useContext, useEffect } from 'react'
import type {
  Conversation,
  ChatContext as IChatContext
} from '@shared/entities'
import { useConversation } from '@webview/hooks/chat/use-conversation'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'
import { useRouteParams } from '@webview/hooks/use-route-params'
import type { ChatStore } from '@webview/stores/chat-store'
import type { ChatUIStore } from '@webview/stores/chat-ui-store'
import type { Updater } from 'use-immer'

import { useChatStore } from '../stores/chat-store-context'
import { useChatUIStore } from '../stores/chat-ui-store-context'

type ChatContextValue = ChatStore &
  ChatUIStore & {
    getContext: () => IChatContext
    newConversation: Conversation
    setNewConversation: Updater<Conversation>
    resetNewConversation: () => void
  }

const ChatContext = createContext<ChatContextValue | null>(null)

export const useChatContext = () => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within a ChatContextProvider')
  }
  return context
}

export const ChatContextProvider: FC<React.PropsWithChildren> = ({
  children
}) => {
  const chatStore = useChatStore(state => state)
  const chatUIStore = useChatUIStore(state => state)
  const { refreshChatSessions } = chatStore
  const { switchSession } = useChatRouter()

  const {
    conversation: newConversation,
    setConversation: setNewConversation,
    resetConversation: resetNewConversation
  } = useConversation('human')

  useEffect(() => {
    refreshChatSessions()
  }, [refreshChatSessions])

  const getContext = useCallbackRef(() => chatStore.context)

  return (
    <ChatContext.Provider
      value={{
        ...chatStore,
        ...chatUIStore,
        switchSession,
        getContext,
        newConversation,
        setNewConversation,
        resetNewConversation
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

const useChatRouter = () => {
  const { chatSessions, switchSession: switchSessionFromStore } = useChatStore(
    state => state
  )

  const lastSession = [...chatSessions].sort(
    (a, b) => b.updatedAt - a.updatedAt
  )[0]

  const { setParam } = useRouteParams({
    pathname: '/',
    params: {
      sessionId: {
        validate: sessionId =>
          chatSessions.some(session => session.id === sessionId),
        defaultValue: lastSession?.id,
        onChange: switchSessionFromStore
      }
    }
  })

  return {
    switchSession: async (sessionId: string) =>
      await setParam('sessionId', sessionId)
  }
}
