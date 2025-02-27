/* eslint-disable react-compiler/react-compiler */
import React, { createContext, useContext, useRef, type FC } from 'react'
import { ChatStore, createChatStore } from '@webview/stores/chat-store'
import { useTranslation } from 'react-i18next'
import { useStore, type StoreApi } from 'zustand'

const ChatStoreContext = createContext<StoreApi<ChatStore> | null>(null)

export const ChatStoreProvider: FC<{
  overrides?: Partial<ChatStore>
  children: React.ReactNode
}> = ({ children, overrides }) => {
  const { t } = useTranslation()
  const storeRef = useRef<StoreApi<ChatStore>>(null)

  if (!storeRef.current) {
    storeRef.current = createChatStore({ ...overrides, t })
  }

  return (
    <ChatStoreContext.Provider value={storeRef.current}>
      {children}
    </ChatStoreContext.Provider>
  )
}

export const useChatStore = <T,>(selector: (store: ChatStore) => T): T => {
  const store = useContext(ChatStoreContext)
  if (!store) {
    throw new Error('useChatStore must be used within ChatStoreProvider')
  }
  return useStore(store, selector)
}
