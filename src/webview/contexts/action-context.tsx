import React, { createContext, FC, useContext } from 'react'
import { useGlobalActions } from '@webview/actions'

type ActionContextValue = {}

const ActionContext = createContext<ActionContextValue | null>(null)

export const useActionContext = () => {
  const context = useContext(ActionContext)
  if (!context) {
    throw new Error(
      'useActionContext must be used within a ActionContextProvider'
    )
  }
  return context
}

export const ActionContextProvider: FC<
  ActionContextValue & { children: React.ReactNode }
> = ({ children }) => {
  useGlobalActions()

  return <ActionContext.Provider value={{}}>{children}</ActionContext.Provider>
}
