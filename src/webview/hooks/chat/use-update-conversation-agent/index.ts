import type { ChatContext, Conversation } from '@shared/entities'
import { createParseManager, CustomTag } from '@shared/plugins/markdown/parsers'
import {
  addOrUpdateAgents,
  type AgentPatchInput
} from '@shared/utils/chat-context-helper/common/agent-utils'
import { getAllTextFromConversationContents } from '@shared/utils/chat-context-helper/common/get-all-text-from-conversation-contents'
import { settledPromiseResults } from '@shared/utils/common'
import { useAgentPluginIsSameAgent } from '@webview/contexts/plugin-context/use-agent-plugin'
import { produce } from 'immer'
import type { Updater } from 'use-immer'

import { useEditFileAgent } from './use-edit-file-agent'
import { useWebPreviewAgent } from './use-web-preview-agent'

export interface UseUpdateConversationAgentProps {}

export interface UpdateConversationAgentProps {
  conversation: Conversation
  setConversation?: Updater<Conversation>
}

export interface UpdateConversationsAgentsProps {
  conversations: Conversation[]
  setChatContext?: Updater<ChatContext>
}

export const useUpdateConversationAgent = () => {
  const isSameAgent = useAgentPluginIsSameAgent()
  const createEditFileAgent = useEditFileAgent()
  const createWebPreviewAgent = useWebPreviewAgent()

  const updateConversationAgent = ({
    conversation,
    setConversation
  }: UpdateConversationAgentProps) => {
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

    const inputAgents: AgentPatchInput<any>[] = []

    const mdParserManager = createParseManager({
      onParseNodeSuccess(result) {
        if (result.type === 'code' && result.isBlockClosed) {
          const agent = createEditFileAgent(result)
          if (agent) {
            inputAgents.push(agent)
          }
        }

        if (
          result.type === 'xml' &&
          result.isBlockClosed &&
          result.tagName === CustomTag.V1Project
        ) {
          const agent = createWebPreviewAgent(result, conversation)
          if (agent) {
            inputAgents.push(agent)
          }
        }
      }
    })

    mdParserManager.parseMarkdownContent(
      getAllTextFromConversationContents(conversation.contents)
    )

    let runSuccessEvents: () => Promise<void> = async () => {}

    if (inputAgents.length) {
      const result = addOrUpdateAgents({
        conversation: finalConversation,
        setConversation: setFinalConversation,
        isSameAgent,
        inputAgents
      })

      runSuccessEvents = result.runSuccessEvents
    }

    return {
      conversation: finalConversation,
      runSuccessEvents
    }
  }

  const updateConversationsAgents = ({
    conversations,
    setChatContext
  }: UpdateConversationsAgentsProps) => {
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

      const result = updateConversationAgent({
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
    updateConversationAgent,
    updateConversationsAgents
  }
}
