import React, { createContext, FC, useContext } from 'react'
import type { Conversation } from '@shared/entities'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'
import type { Updater } from 'use-immer'

type ConversationContextValue = {
  conversation: Conversation
  setConversation: Updater<Conversation>
  getConversation: () => Conversation
}

const ConversationContext = createContext<ConversationContextValue | null>(null)

export const useConversationContext = () => {
  const context = useContext(ConversationContext)
  if (!context) {
    throw new Error(
      'useConversationContext must be used within a ConversationContextProvider'
    )
  }
  return context
}

export const ConversationContextProvider: FC<
  {
    children: React.ReactNode
  } & Omit<ConversationContextValue, 'getConversation'>
> = ({ children, ...values }) => {
  const getConversation = useCallbackRef(() => values.conversation)

  return (
    <ConversationContext.Provider
      value={{
        ...values,
        getConversation
      }}
    >
      {children}
    </ConversationContext.Provider>
  )
}
