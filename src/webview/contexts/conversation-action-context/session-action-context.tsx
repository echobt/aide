import React, { createContext, FC, useContext, useRef } from 'react'
import type {
  ChatContext,
  Conversation,
  ConversationAction
} from '@shared/entities'
import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'

import { useAgentPluginIsSameAction } from '../plugin-context/use-agent-plugin'

type SessionActionContextValue = {
  startActionMutation: UseMutationResult<
    void,
    Error,
    {
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
    },
    unknown
  >
  restartActionMutation: UseMutationResult<
    void,
    Error,
    {
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
    },
    unknown
  >
  acceptActionMutation: UseMutationResult<
    void,
    Error,
    {
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
    },
    unknown
  >
  rejectActionMutation: UseMutationResult<
    void,
    Error,
    {
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
    },
    unknown
  >
  acceptMultipleActionsMutation: UseMutationResult<
    void,
    Error,
    {
      chatContext: ChatContext
      actionItems: { conversation: Conversation; action: ConversationAction }[]
    },
    unknown
  >
  rejectMultipleActionsMutation: UseMutationResult<
    void,
    Error,
    {
      chatContext: ChatContext
      actionItems: { conversation: Conversation; action: ConversationAction }[]
    },
    unknown
  >
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
    mutationFn: (params: {
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
    }) => {
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
    mutationFn: (params: {
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
    }) => {
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
    mutationFn: (params: {
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
    }) => {
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
    mutationFn: (params: {
      chatContext: ChatContext
      conversation: Conversation
      action: ConversationAction
    }) => {
      abortOldAction(params.action)
      const abortController = new AbortController()
      addActionAbortController(params.action, abortController)
      return api.actions().server.agent.rejectAction({
        actionParams: params,
        abortController
      })
    }
  })

  const acceptMultipleActionsMutation = useMutation({
    mutationFn: (params: {
      chatContext: ChatContext
      actionItems: { conversation: Conversation; action: ConversationAction }[]
    }) => {
      params.actionItems.forEach(item => {
        abortOldAction(item.action)
      })
      return api.actions().server.agent.acceptMultipleActions({
        actionParams: params
      })
    }
  })

  const rejectMultipleActionsMutation = useMutation({
    mutationFn: (params: {
      chatContext: ChatContext
      actionItems: { conversation: Conversation; action: ConversationAction }[]
    }) => {
      params.actionItems.forEach(item => {
        abortOldAction(item.action)
      })
      return api.actions().server.agent.rejectMultipleActions({
        actionParams: params
      })
    }
  })

  return (
    <SessionActionContext.Provider
      value={{
        startActionMutation,
        restartActionMutation,
        acceptActionMutation,
        rejectActionMutation,
        acceptMultipleActionsMutation,
        rejectMultipleActionsMutation
      }}
    >
      {children}
    </SessionActionContext.Provider>
  )
}
