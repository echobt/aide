import React, { createContext, FC, useContext, useRef } from 'react'
import type { ConversationAction } from '@shared/entities'
import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'
import type {
  MultipleSessionActionParams,
  SingleSessionActionParams
} from '@webview/types/chat'

import { useAgentPluginIsSameAction } from '../plugin-context/use-agent-plugin'

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
  const actionAbortControllersMapRef = useRef<
    Map<ConversationAction, AbortController[]>
  >(new Map())

  const isSameAction = useAgentPluginIsSameAction()

  const abortOldAction = (action: ConversationAction) => {
    const actions = actionAbortControllersMapRef.current.keys()
    const targetAction = actions.find(a => isSameAction(a, action))
    if (targetAction) {
      const abortControllers =
        actionAbortControllersMapRef.current.get(targetAction)
      abortControllers?.forEach(abortController => {
        abortController.abort()
      })
      actionAbortControllersMapRef.current.delete(targetAction)
    }
  }

  const addActionAbortController = (
    action: ConversationAction,
    abortController: AbortController
  ) => {
    const abortControllers = actionAbortControllersMapRef.current.get(action)
    if (abortControllers) {
      abortControllers.push(abortController)
    } else {
      actionAbortControllersMapRef.current.set(action, [abortController])
    }
  }

  const startActionMutation = useMutation({
    mutationFn: (params: SingleSessionActionParams) => {
      abortOldAction(params.action)
      const abortController = new AbortController()
      addActionAbortController(params.action, abortController)
      return api.actions().server.agent.startAction({
        actionParams: params,
        abortController
      })
    }
  })

  const restartActionMutation = useMutation({
    mutationFn: (params: SingleSessionActionParams) => {
      abortOldAction(params.action)
      const abortController = new AbortController()
      addActionAbortController(params.action, abortController)
      return api.actions().server.agent.restartAction({
        actionParams: params,
        abortController
      })
    }
  })

  const acceptActionMutation = useMutation({
    mutationFn: (params: SingleSessionActionParams) => {
      abortOldAction(params.action)
      const abortController = new AbortController()
      addActionAbortController(params.action, abortController)
      return api.actions().server.agent.acceptAction({
        actionParams: params,
        abortController
      })
    }
  })

  const rejectActionMutation = useMutation({
    mutationFn: (params: SingleSessionActionParams) => {
      abortOldAction(params.action)
      const abortController = new AbortController()
      addActionAbortController(params.action, abortController)
      return api.actions().server.agent.rejectAction({
        actionParams: params,
        abortController
      })
    }
  })

  const refreshActionMutation = useMutation({
    mutationFn: (params: SingleSessionActionParams) =>
      api.actions().server.agent.refreshAction({
        actionParams: params
      })
  })

  const acceptMultipleActionsMutation = useMutation({
    mutationFn: (params: MultipleSessionActionParams) => {
      params.actionItems.forEach(item => {
        abortOldAction(item.action)
      })
      return api.actions().server.agent.acceptMultipleActions({
        actionParams: params
      })
    }
  })

  const rejectMultipleActionsMutation = useMutation({
    mutationFn: (params: MultipleSessionActionParams) => {
      params.actionItems.forEach(item => {
        abortOldAction(item.action)
      })
      return api.actions().server.agent.rejectMultipleActions({
        actionParams: params
      })
    }
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
