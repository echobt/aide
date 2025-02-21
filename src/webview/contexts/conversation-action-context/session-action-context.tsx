import React, { createContext, FC, useContext } from 'react'
import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'
import type {
  MultipleSessionActionParams,
  SingleSessionActionParams
} from '@webview/types/chat'

type SingleSessionActionMutation = UseMutationResult<
  void,
  Error,
  SingleSessionActionParams,
  unknown
>

// Type for multiple actions mutation result
type MultipleSessionActionMutation = UseMutationResult<
  void,
  Error,
  MultipleSessionActionParams,
  unknown
>

type SessionActionContextValue = {
  startActionMutation: SingleSessionActionMutation
  restartActionMutation: SingleSessionActionMutation
  acceptActionMutation: SingleSessionActionMutation
  rejectActionMutation: SingleSessionActionMutation
  refreshActionMutation: SingleSessionActionMutation
  acceptMultipleActionsMutation: MultipleSessionActionMutation
  rejectMultipleActionsMutation: MultipleSessionActionMutation
  refreshMultipleActionsMutation: MultipleSessionActionMutation
}

const SessionActionContext = createContext<SessionActionContextValue | null>(
  null
)

export const useSessionActionContext = () => {
  const context = useContext(SessionActionContext)
  if (!context) {
    throw new Error(
      'useSessionActionContext must be used within a SessionActionContextProvider'
    )
  }
  return context
}

export const SessionActionContextProvider: FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const startActionMutation = useMutation({
    mutationFn: (params: SingleSessionActionParams) =>
      api.actions().server.agent.startAction({
        actionParams: params
      })
  })

  const restartActionMutation = useMutation({
    mutationFn: (params: SingleSessionActionParams) =>
      api.actions().server.agent.restartAction({
        actionParams: params
      })
  })

  const acceptActionMutation = useMutation({
    mutationFn: (params: SingleSessionActionParams) =>
      api.actions().server.agent.acceptAction({
        actionParams: params
      })
  })

  const rejectActionMutation = useMutation({
    mutationFn: (params: SingleSessionActionParams) =>
      api.actions().server.agent.rejectAction({
        actionParams: params
      })
  })

  const refreshActionMutation = useMutation({
    mutationFn: (params: SingleSessionActionParams) =>
      api.actions().server.agent.refreshAction({
        actionParams: params
      })
  })

  const acceptMultipleActionsMutation = useMutation({
    mutationFn: (params: MultipleSessionActionParams) =>
      api.actions().server.agent.acceptMultipleActions({
        actionParams: params
      })
  })

  const rejectMultipleActionsMutation = useMutation({
    mutationFn: (params: MultipleSessionActionParams) =>
      api.actions().server.agent.rejectMultipleActions({
        actionParams: params
      })
  })

  const refreshMultipleActionsMutation = useMutation({
    mutationFn: (params: MultipleSessionActionParams) =>
      api.actions().server.agent.refreshMultipleActions({
        actionParams: params
      })
  })

  return (
    <SessionActionContext.Provider
      value={{
        startActionMutation,
        restartActionMutation,
        acceptActionMutation,
        rejectActionMutation,
        refreshActionMutation,
        acceptMultipleActionsMutation,
        rejectMultipleActionsMutation,
        refreshMultipleActionsMutation
      }}
    >
      {children}
    </SessionActionContext.Provider>
  )
}
