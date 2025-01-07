import React, { createContext, FC, useContext } from 'react'
import type { Conversation, ConversationAction } from '@shared/entities'
import type { Updater } from 'use-immer'
import { v4 as uuidv4 } from 'uuid'

import { useAgentPluginIsSameAction } from '../plugin-context/use-agent-plugin'

type AddAction = <T extends ConversationAction>(props: {
  currentContent: string
  action: Omit<T, 'id' | 'weight'>
  onRemoveSameAction: (action: T) => void
}) => void

type MarkdownActionContextValue = {
  addAction: AddAction
}

const MarkdownActionContext = createContext<MarkdownActionContextValue | null>(
  null
)

export const useMarkdownActionContext = () => {
  const context = useContext(MarkdownActionContext)
  if (!context) {
    throw new Error(
      'useAgentActionContext must be used within a AgentActionContextProvider'
    )
  }
  return context
}

export const MarkdownActionContextProvider: FC<{
  conversation: Conversation
  setConversation: Updater<Conversation>
  children: React.ReactNode
}> = ({ conversation, setConversation, children }) => {
  const isSameAction = useAgentPluginIsSameAction()

  const addAction: AddAction = ({
    currentContent,
    action,
    onRemoveSameAction
  }) => {
    if (!conversation || !setConversation)
      throw new Error(
        'useAddAction: Please provide conversation and setConversation'
      )

    let weight = 0 // text end index

    for (let i = 0; i < conversation.contents.length; i++) {
      const content = conversation.contents[i]!
      if (content.type === 'text') {
        if (content.text.includes(currentContent)) {
          weight += content.text.indexOf(currentContent)
          weight += currentContent.length
          break
        } else {
          weight += content.text.length
        }
      } else {
        weight += 1
      }
    }

    const currentAction = { ...action, id: uuidv4(), weight }

    setConversation(draft => {
      const sameActionIndex = draft.actions.findIndex(action =>
        isSameAction(currentAction, action)
      )

      const sameAction = draft.actions[sameActionIndex] as
        | ConversationAction
        | undefined

      if (!sameAction) {
        draft.actions.push(currentAction)
      } else {
        if (sameAction.weight >= currentAction.weight) return
        onRemoveSameAction(sameAction as any)
        draft.actions[sameActionIndex] = currentAction
      }
    })
  }

  return (
    <MarkdownActionContext.Provider value={{ addAction }}>
      {children}
    </MarkdownActionContext.Provider>
  )
}
