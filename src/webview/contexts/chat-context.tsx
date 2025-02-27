import React, {
  createContext,
  FC,
  useContext,
  useEffect,
  useState
} from 'react'
import {
  ChatContextType,
  type Conversation,
  type ChatContext as IChatContext
} from '@shared/entities'
import { isAbortError } from '@shared/utils/common'
import { useCurrentFile } from '@webview/hooks/api/use-files'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { useConversation } from '@webview/hooks/chat/use-conversation'
import { useLastDefaultV1PresetName } from '@webview/hooks/chat/use-storage-vars'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'
import { useQueryState } from '@webview/hooks/use-query-state'
import { api } from '@webview/network/actions-api'
import type { ChatStore } from '@webview/stores/chat-store'
import type { ChatUIStore } from '@webview/stores/chat-ui-store'
import { logAndToastError } from '@webview/utils/common'
import type { Updater } from 'use-immer'

import { useChatStore } from '../stores/chat-store-context'
import { useChatUIStore } from '../stores/chat-ui-store-context'

type ChatContextValue = ChatStore &
  ChatUIStore & {
    getContext: () => IChatContext
    newConversation: Conversation
    isSwitchingSession: boolean
    setIsSwitchingSession: (isSwitchingSession: boolean) => void
    setNewConversation: Updater<Conversation>
    resetNewConversation: () => void
    switchSession: (sessionId: string) => Promise<void>
    createNewSessionAndSwitch: (
      initialContext?: Partial<IChatContext>
    ) => Promise<void>
    deleteSessionAndSwitch: (sessionId: string) => Promise<void>
    deleteSessionsAndSwitch: (sessionIds: string[]) => Promise<void>
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
    deleteSessions,
    chatSessions
  } = chatStore
  const { switchSession, isSwitchingSession, setIsSwitchingSession } =
    useChatRouter(disableEffect)

  const isGenerating = context.conversations.some(
    conversation => conversation.state.isGenerating
  )

  useEffect(() => {
    if (isGenerating) {
      setIsSending(true)
    }
  }, [isGenerating])

  const { data: currentFile } = useCurrentFile()

  const {
    conversation: newConversation,
    setConversation: setNewConversation,
    resetConversation: resetNewConversation
  } = useConversation('human')

  const shouldAutoAddCurrentFile = [
    ChatContextType.Chat,
    ChatContextType.Composer,
    ChatContextType.Agent
  ].includes(context.type)

  useEffect(() => {
    if (currentFile) {
      // auto add current file to conversation
      setNewConversation(draft => {
        if (!draft.contents.length) {
          if (shouldAutoAddCurrentFile) {
            draft.state.selectedFilesFromFileSelector = [currentFile]
          } else {
            const index = draft.state.selectedFilesFromFileSelector.findIndex(
              file => file.schemeUri === currentFile.schemeUri
            )
            if (index !== -1) {
              draft.state.selectedFilesFromFileSelector.splice(index, 1)
            }
          }
        }
      })
    }
  }, [currentFile, shouldAutoAddCurrentFile])

  useEffect(() => {
    if (disableEffect) return
    refreshChatSessions()
  }, [disableEffect])

  const { invalidateQueries } = useInvalidateQueries()
  useEffect(() => {
    if (context.id) {
      invalidateQueries({
        type: 'current-webview',
        queryKeys: ['realtime']
      })
    }
  }, [context.id])

  const getContext = useCallbackRef(() => context)
  const [lastDefaultV1PresetName] = useLastDefaultV1PresetName()

  const createNewSessionAndSwitch = async (
    initialContext?: Partial<IChatContext>
  ) => {
    const newSession = await createNewSession({
      ...initialContext,
      type: initialContext?.type ?? getContext().type,

      // settings
      settings: {
        ...getContext().settings,
        ...initialContext?.settings,

        // default v1 preset name
        defaultV1PresetName:
          initialContext?.settings?.defaultV1PresetName ??
          lastDefaultV1PresetName ??
          getContext().settings.defaultV1PresetName
      }
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

  const deleteSessionsAndSwitch = async (sessionIds: string[]) => {
    await deleteSessions(sessionIds)
    // switch to the last session
    const lastSession = [...chatSessions]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .find(session => !sessionIds.includes(session.id))
    if (!lastSession) return
    await switchSession(lastSession.id)
  }

  return (
    <ChatContext.Provider
      value={{
        ...chatStore,
        ...chatUIStore,
        switchSession,
        isSwitchingSession,
        setIsSwitchingSession,
        getContext,
        newConversation,
        setNewConversation,
        resetNewConversation,
        createNewSessionAndSwitch,
        deleteSessionAndSwitch,
        deleteSessionsAndSwitch
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

const useChatRouter = (disableEffect: boolean) => {
  const [isSwitchingSession, setIsSwitchingSession] = useState(false)
  const { chatSessions, context, setContext, setIsSending } = useChatStore(
    state => state
  )

  const lastSession = [...chatSessions].sort(
    (a, b) => b.updatedAt - a.updatedAt
  )[0]

  const [sessionId, setSessionId] = useQueryState('sessionId', {
    defaultValue: lastSession?.id ?? null,
    parse: value => {
      if (!value) return lastSession?.id ?? null
      return chatSessions.some(session => session.id === value)
        ? value
        : (lastSession?.id ?? null)
    }
  })

  useEffect(() => {
    if (disableEffect || !sessionId) return

    const abortController = new AbortController()
    let isCurrentRequest = true
    const getIsCurrentRequest = () =>
      isCurrentRequest && !abortController.signal.aborted

    const loadSession = async () => {
      try {
        if (context.id === sessionId) return
        setIsSwitchingSession(true)

        const fullChatContext = await api
          .actions()
          .server.chatSession.getChatContext({
            actionParams: { sessionId },
            abortController
          })

        if (getIsCurrentRequest()) {
          if (!fullChatContext) throw new Error('Chat context not found')
          setContext(fullChatContext)
        }
      } catch (error) {
        if (!isAbortError(error) && getIsCurrentRequest()) {
          logAndToastError(`Failed to switch to session ${sessionId}`, error)
        }
      } finally {
        if (getIsCurrentRequest()) {
          setIsSwitchingSession(false)
        }
      }
    }

    loadSession()

    return () => {
      isCurrentRequest = false
      abortController.abort()
    }
  }, [sessionId, context.id, disableEffect])

  const switchSession = async (newSessionId: string) => {
    setIsSending(false)
    await setSessionId(newSessionId)
  }

  return { switchSession, isSwitchingSession, setIsSwitchingSession }
}
