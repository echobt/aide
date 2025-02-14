import type { ChatContext, ChatSession, Conversation } from '@shared/entities'
import { ChatContextEntity } from '@shared/entities'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { logger } from '@webview/utils/logger'
import { produce } from 'immer'
import type { DraftFunction } from 'use-immer'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type ChatStore = {
  context: ChatContext
  chatSessions: ChatSession[]
  setContext: (
    contextOrUpdater: ChatContext | DraftFunction<ChatContext>
  ) => void
  isSending: boolean
  setIsSending: (isSending: boolean) => void
  getConversation: (id: string) => Conversation | undefined
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, conversation: Conversation) => void
  deleteConversation: (id: string) => void
  resetContext: () => void
  saveSession: (refresh?: boolean) => Promise<void>
  refreshChatSessions: () => Promise<void>
  createNewSession: (
    initialContext?: Partial<ChatContext>
  ) => Promise<ChatSession | undefined>
  deleteSession: (id: string) => Promise<void>
  refreshCurrentChatSession: () => Promise<void>
}

export const createChatStore = (overrides?: Partial<ChatStore>) =>
  create<ChatStore>()(
    immer((set, get) => ({
      context: new ChatContextEntity().entity,
      chatSessions: [] as ChatSession[],
      setContext: contextOrUpdater => {
        if (typeof contextOrUpdater === 'function') {
          const newContext = produce(get().context, contextOrUpdater)

          set(state => {
            state.context = newContext
          })
        } else {
          set(state => {
            state.context = contextOrUpdater
          })
        }
      },
      isSending: false,
      setIsSending: isSending => set({ isSending }),
      getConversation: id => get().context.conversations.find(c => c.id === id),
      addConversation: conversation =>
        set(state => {
          state.context.conversations.push(conversation)
        }),
      updateConversation: (id, conversation) =>
        set(state => {
          const index = state.context.conversations.findIndex(c => c.id === id)
          if (index !== -1) {
            state.context.conversations[index] = conversation
          }
        }),
      deleteConversation: id =>
        set(state => {
          state.context.conversations = state.context.conversations.filter(
            c => c.id !== id
          )
        }),
      resetContext: () => set({ context: new ChatContextEntity().entity }),
      saveSession: async (refresh = true) => {
        try {
          await api.actions().server.chatSession.createOrUpdateSession({
            actionParams: {
              chatContext: get().context
            }
          })

          if (refresh) {
            await get().refreshChatSessions()
          }
        } catch (error) {
          logAndToastError('Failed to save session', error)
        }
      },
      refreshChatSessions: async () => {
        try {
          const sessions = await api
            .actions()
            .server.chatSession.getAllSessions({
              actionParams: {}
            })
          set(state => {
            state.chatSessions = sessions.sort(
              (a, b) => b.updatedAt - a.updatedAt
            )
          })
        } catch (error) {
          logAndToastError('Failed to refresh chat sessions', error)
        }
      },
      createNewSession: async (initialContext?: Partial<ChatContext>) => {
        try {
          const newContext = {
            ...new ChatContextEntity().entity,
            ...initialContext
          }
          const newSession = await api
            .actions()
            .server.chatSession.createSession({
              actionParams: {
                chatContext: newContext
              }
            })
          await get().refreshChatSessions()
          logger.log('New chat created', newSession)
          return newSession
        } catch (error) {
          logger.error('Failed to create and switch to new chat', error)
          return undefined
        }
      },
      deleteSession: async id => {
        try {
          await api.actions().server.chatSession.deleteSession({
            actionParams: { sessionId: id }
          })
          await get().refreshChatSessions()
          logger.log(`Chat ${id} deleted`)
        } catch (error) {
          logger.error(`Failed to delete chat ${id}`, error)
        }
      },
      refreshCurrentChatSession: async () => {
        try {
          const fullChatContext = await api
            .actions()
            .server.chatSession.getChatContext({
              actionParams: { sessionId: get().context.id }
            })
          if (!fullChatContext) throw new Error('Chat context not found')
          set({ context: fullChatContext })
        } catch (error) {
          logAndToastError(
            `Failed to refresh session ${get().context.id}`,
            error
          )
        }
      },
      ...overrides
    }))
  )
