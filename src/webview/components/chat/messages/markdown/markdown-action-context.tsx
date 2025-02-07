import React, { createContext, FC, useContext } from 'react'
import type { Conversation, ConversationAction } from '@shared/entities'
import type { MaybePromise } from '@shared/types/common'
import { useChatContext } from '@webview/contexts/chat-context'
import { useAgentPluginIsSameAction } from '@webview/contexts/plugin-context/use-agent-plugin'
import type { Updater } from 'use-immer'
import { v4 as uuidv4 } from 'uuid'

type AddAction = <T extends ConversationAction>(props: {
  currentContent: string
  action: Omit<T, 'id' | 'weight'>
  onSuccess?: (props: {
    conversationId: string
    action: T
    oldAction?: T
  }) => MaybePromise<void>
}) => Promise<void>

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
      'useMarkdownActionContext must be used within a MarkdownActionContextProvider'
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
  const { saveSession } = useChatContext()

  const addAction: AddAction = async ({
    currentContent,
    action,
    onSuccess
  }) => {
    const events: (() => MaybePromise<void>)[] = []
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
        events.push(() =>
          onSuccess?.({
            conversationId: conversation.id,
            action: currentAction as any,
            oldAction: undefined
          })
        )
      } else {
        if (sameAction.weight >= currentAction.weight) return
        draft.actions[sameActionIndex] = currentAction
        events.push(() =>
          onSuccess?.({
            conversationId: conversation.id,
            action: currentAction as any,
            oldAction: sameAction as any
          })
        )
      }
    })

    await saveSession()

    await Promise.all(events.map(event => event()))
  }

  return (
    <MarkdownActionContext.Provider value={{ addAction }}>
      {children}
    </MarkdownActionContext.Provider>
  )
}
