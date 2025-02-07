import React, { createContext, FC, useContext } from 'react'
import type { Conversation } from '@shared/entities'
import type { Updater } from 'use-immer'

type ConversationContextValue = {
  conversation: Conversation
  setConversation: Updater<Conversation>
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
  } & ConversationContextValue
> = ({ children, ...values }) => (
  <ConversationContext.Provider value={values}>
    {children}
  </ConversationContext.Provider>
)
