import React, { createContext, FC, useContext, useEffect } from 'react'
import type {
  Conversation,
  ChatContext as IChatContext
} from '@shared/entities'
import { useConversation } from '@webview/hooks/chat/use-conversation'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'
import { api } from '@webview/network/actions-api'
import type { ChatStore } from '@webview/stores/chat-store'
import type { ChatUIStore } from '@webview/stores/chat-ui-store'
import { logAndToastError } from '@webview/utils/common'
import { useQueryState } from 'nuqs'
import type { Updater } from 'use-immer'

import { useChatStore } from '../stores/chat-store-context'
import { useChatUIStore } from '../stores/chat-ui-store-context'

type ChatContextValue = ChatStore &
  ChatUIStore & {
    getContext: () => IChatContext
    newConversation: Conversation
    setNewConversation: Updater<Conversation>
    resetNewConversation: () => void
    switchSession: (sessionId: string) => Promise<void>
    createNewSessionAndSwitch: (
      initialContext?: Partial<IChatContext>
    ) => Promise<void>
    deleteSessionAndSwitch: (sessionId: string) => Promise<void>
  }

const ChatContext = createContext<ChatContextValue | null>(null)

export const useChatContext = () => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within a ChatContextProvider')
  }
  return context
}

export const ChatContextProvider: FC<
  React.PropsWithChildren & {
    disableEffect?: boolean
  }
> = ({ children, disableEffect = false }) => {
  const chatStore = useChatStore(state => state)
  const chatUIStore = useChatUIStore(state => state)
  const {
    context,
    refreshChatSessions,
    setIsSending,
    createNewSession,
    deleteSession,
    chatSessions
  } = chatStore
  const { switchSession } = useChatRouter(disableEffect)

  const isGenerating = context.conversations.some(
    conversation => conversation.state.isGenerating
  )

  useEffect(() => {
    if (isGenerating) {
      setIsSending(true)
    }
  }, [isGenerating])

  const {
    conversation: newConversation,
    setConversation: setNewConversation,
    resetConversation: resetNewConversation
  } = useConversation('human')

  useEffect(() => {
    if (disableEffect) return
    refreshChatSessions()
  }, [disableEffect])

  const getContext = useCallbackRef(() => context)

  const createNewSessionAndSwitch = async (
    initialContext?: Partial<IChatContext>
  ) => {
    const newSession = await createNewSession({
      type: getContext().type,
      ...initialContext
    })
    if (!newSession) return
    await switchSession(newSession.id)
  }

  const deleteSessionAndSwitch = async (sessionId: string) => {
    await deleteSession(sessionId)
    // switch to the last session
    const lastSession = [...chatSessions]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .find(session => session.id !== sessionId)
    if (!lastSession) return
    await switchSession(lastSession.id)
  }

  return (
    <ChatContext.Provider
      value={{
        ...chatStore,
        ...chatUIStore,
        switchSession,
        getContext,
        newConversation,
        setNewConversation,
        resetNewConversation,
        createNewSessionAndSwitch,
        deleteSessionAndSwitch
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

const useChatRouter = (disableEffect: boolean) => {
  const { chatSessions, context, setContext, setIsSending } = useChatStore(
    state => state
  )

  const lastSession = [...chatSessions].sort(
    (a, b) => b.updatedAt - a.updatedAt
  )[0]

  const [sessionId, setSessionId] = useQueryState('sessionId', {
    defaultValue: lastSession?.id ?? null,
    parse: (value: string | null) => {
      if (!value) return lastSession?.id ?? null
      return chatSessions.some(session => session.id === value)
        ? value
        : (lastSession?.id ?? null)
    }
  })

  useEffect(() => {
    if (disableEffect || !sessionId) return

    const loadSession = async () => {
      try {
        if (context.id === sessionId) return
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
  }, [sessionId, context.id, disableEffect])

  const switchSession = async (newSessionId: string) => {
    setIsSending(false)
    await setSessionId(newSessionId)
  }

  return { switchSession }
}
