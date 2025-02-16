import type { ChatContext, Conversation } from '@shared/entities'
import { createParseManager } from '@shared/plugins/markdown/parsers'
import {
  addOrUpdateActions,
  type ActionPatchInput
} from '@shared/utils/chat-context-helper/common/action-utils'
import { getAllTextFromConversationContents } from '@shared/utils/chat-context-helper/common/get-all-text-from-conversation-contents'
import { settledPromiseResults } from '@shared/utils/common'
import { useAgentPluginIsSameAction } from '@webview/contexts/plugin-context/use-agent-plugin'
import { produce } from 'immer'
import type { Updater } from 'use-immer'

import { useEditFileAction } from './use-edit-file-action'
import { useWebPreviewAction } from './use-web-preview-action'

export interface UseUpdateConversationActionProps {}

export interface UpdateConversationActionProps {
  conversation: Conversation
  setConversation?: Updater<Conversation>
}

export interface UpdateConversationsActionsProps {
  conversations: Conversation[]
  setChatContext?: Updater<ChatContext>
}

export const useUpdateConversationAction = () => {
  const isSameAction = useAgentPluginIsSameAction()
  const createEditFileAction = useEditFileAction()
  const createWebPreviewAction = useWebPreviewAction()

  const updateConversationAction = ({
    conversation,
    setConversation
  }: UpdateConversationActionProps) => {
    let finalConversation = conversation
    const setFinalConversation: Updater<Conversation> =
      setConversation ||
      (updater => {
        if (typeof updater === 'function') {
          finalConversation = produce(finalConversation, updater)
        } else {
          finalConversation = updater
        }
      })

    const inputActions: ActionPatchInput<any>[] = []

    const mdParserManager = createParseManager({
      onParseNodeSuccess(result) {
        if (result.type === 'code' && result.isBlockClosed) {
          const action = createEditFileAction(result)
          if (action) {
            inputActions.push(action)
          }
        }

        if (
          result.type === 'xml' &&
          result.isBlockClosed &&
          result.tagName === 'V1Project'
        ) {
          const action = createWebPreviewAction(result, conversation)
          if (action) {
            inputActions.push(action)
          }
        }
      }
    })

    mdParserManager.parseMarkdownContent(
      getAllTextFromConversationContents(conversation.contents)
    )

    let runSuccessEvents: () => Promise<void> = async () => {}

    if (inputActions.length) {
      const result = addOrUpdateActions({
        conversation: finalConversation,
        setConversation: setFinalConversation,
        isSameAction,
        inputActions
      })

      runSuccessEvents = result.runSuccessEvents
    }

    return {
      conversation: finalConversation,
      runSuccessEvents
    }
  }

  const updateConversationsActions = ({
    conversations,
    setChatContext
  }: UpdateConversationsActionsProps) => {
    const finalConversations = conversations
    const successEvents: (() => Promise<void>)[] = []

    for (const [index, conversation] of finalConversations.entries()) {
      const setConversationForChatContext: Updater<Conversation> = updater => {
        setChatContext?.(draft => {
          const index = draft.conversations.findIndex(
            c => c.id === conversation.id
          )

          if (index !== -1) {
            if (typeof updater === 'function') {
              updater(draft.conversations[index]!)
            } else {
              draft.conversations[index] = updater
            }
          }
        })
      }

      const setConversationCustom: Updater<Conversation> = updater => {
        if (typeof updater === 'function') {
          finalConversations[index]! = produce(
            finalConversations[index]!,
            updater
          )
        } else {
          finalConversations[index] = updater
        }
      }

      const setFinalConversation = setChatContext
        ? setConversationForChatContext
        : setConversationCustom

      const result = updateConversationAction({
        conversation,
        setConversation: setFinalConversation
      })

      if (!setChatContext) {
        finalConversations[index] = result.conversation
      }
      successEvents.push(result.runSuccessEvents)
    }

    return {
      conversations: finalConversations,
      runSuccessEvents: async () => {
        await settledPromiseResults(successEvents.map(fn => fn()))
      }
    }
  }

  return {
    updateConversationAction,
    updateConversationsActions
  }
}
