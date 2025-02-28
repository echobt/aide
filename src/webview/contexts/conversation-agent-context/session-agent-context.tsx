import React, { createContext, FC, useContext } from 'react'
import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'
import type {
  MultipleSessionAgentParams,
  SingleSessionAgentParams
} from '@webview/types/chat'

type SingleSessionAgentMutation = UseMutationResult<
  void,
  Error,
  SingleSessionAgentParams,
  unknown
>

// Type for multiple actions mutation result
type MultipleSessionAgentMutation = UseMutationResult<
  void,
  Error,
  MultipleSessionAgentParams,
  unknown
>

type SessionAgentContextValue = {
  startAgentMutation: SingleSessionAgentMutation
  restartAgentMutation: SingleSessionAgentMutation
  acceptAgentMutation: SingleSessionAgentMutation
  rejectAgentMutation: SingleSessionAgentMutation
  refreshAgentMutation: SingleSessionAgentMutation
  acceptMultipleAgentsMutation: MultipleSessionAgentMutation
  rejectMultipleAgentsMutation: MultipleSessionAgentMutation
  refreshMultipleAgentsMutation: MultipleSessionAgentMutation
}

const SessionAgentContext = createContext<SessionAgentContextValue | null>(null)

export const useSessionAgentContext = () => {
  const context = useContext(SessionAgentContext)
  if (!context) {
    throw new Error(
      'useSessionAgentContext must be used within a SessionAgentContextProvider'
    )
  }
  return context
}

export const SessionAgentContextProvider: FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const startAgentMutation = useMutation({
    mutationFn: (params: SingleSessionAgentParams) =>
      api.actions().server.agent.startAgent({
        actionParams: params
      })
  })

  const restartAgentMutation = useMutation({
    mutationFn: (params: SingleSessionAgentParams) =>
      api.actions().server.agent.restartAgent({
        actionParams: params
      })
  })

  const acceptAgentMutation = useMutation({
    mutationFn: (params: SingleSessionAgentParams) =>
      api.actions().server.agent.acceptAgent({
        actionParams: params
      })
  })

  const rejectAgentMutation = useMutation({
    mutationFn: (params: SingleSessionAgentParams) =>
      api.actions().server.agent.rejectAgent({
        actionParams: params
      })
  })

  const refreshAgentMutation = useMutation({
    mutationFn: (params: SingleSessionAgentParams) =>
      api.actions().server.agent.refreshAgent({
        actionParams: params
      })
  })

  const acceptMultipleAgentsMutation = useMutation({
    mutationFn: (params: MultipleSessionAgentParams) =>
      api.actions().server.agent.acceptMultipleAgents({
        actionParams: params
      })
  })

  const rejectMultipleAgentsMutation = useMutation({
    mutationFn: (params: MultipleSessionAgentParams) =>
      api.actions().server.agent.rejectMultipleAgents({
        actionParams: params
      })
  })

  const refreshMultipleAgentsMutation = useMutation({
    mutationFn: (params: MultipleSessionAgentParams) =>
      api.actions().server.agent.refreshMultipleAgents({
        actionParams: params
      })
  })

  return (
    <SessionAgentContext.Provider
      value={{
        startAgentMutation,
        restartAgentMutation,
        acceptAgentMutation,
        rejectAgentMutation,
        refreshAgentMutation,
        acceptMultipleAgentsMutation,
        rejectMultipleAgentsMutation,
        refreshMultipleAgentsMutation
      }}
    >
      {children}
    </SessionAgentContext.Provider>
  )
}
