import {
  ChatContextType,
  type ChatContext,
  type Conversation,
  type WebPreviewProjectFile
} from '@shared/entities'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import type { EditFileAction } from '@shared/plugins/agents/edit-file-agent-plugin/types'
import type { WebPreviewAction } from '@shared/plugins/agents/web-preview-agent-plugin/types'
import {
  createParseManager,
  type MDCodeInfo,
  type V1ProjectTagInfo
} from '@shared/plugins/markdown/parsers'
import {
  addOrUpdateActions,
  type ActionPatchInput
} from '@shared/utils/chat-context-helper/common/action-utils'
import { getAllTextFromConversationContents } from '@shared/utils/chat-context-helper/common/get-all-text-from-conversation-contents'
import {
  getWebPreviewProjectFilesFromParsedContents,
  getWebPreviewProjectVersion
} from '@shared/utils/chat-context-helper/common/web-preview-project'
import { settledPromiseResults } from '@shared/utils/common'
import { useChatWebPreviewContext } from '@webview/components/chat/web-preview/chat-web-preview-context'
import { useChatContext } from '@webview/contexts/chat-context'
import { useSessionActionContext } from '@webview/contexts/conversation-action-context/session-action-context'
import { useAgentPluginIsSameAction } from '@webview/contexts/plugin-context/use-agent-plugin'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { logger } from '@webview/utils/logger'
import { produce } from 'immer'
import type { Updater } from 'use-immer'
import { v4 as uuidv4 } from 'uuid'

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
  const { getContext } = useChatContext()
  const { startActionMutation } = useSessionActionContext()
  const {
    defaultPresetName,
    openPreviewPage,
    setProjectName,
    setProjectVersion,
    stopPreviewMutation
  } = useChatWebPreviewContext()

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
          const parsedInfo = result as MDCodeInfo
          const filePath = parsedInfo.otherInfo?.filePath

          if (filePath) {
            inputActions.push({
              relatedConversationContent: parsedInfo.content,
              action: {
                state: {
                  inlineDiffTask: null
                },
                agent: {
                  id: uuidv4(),
                  name: AgentPluginId.EditFile,
                  input: {
                    blocking: false,
                    codeEdit: parsedInfo.content,
                    instructions: 'Edit the file by composer',
                    targetFilePath: filePath
                  },
                  output: {
                    success: true
                  }
                }
              },
              onApplySuccess: async actionPatch => {
                try {
                  const allowAutoStartAction = [
                    ChatContextType.Composer,
                    ChatContextType.Agent
                  ].includes(getContext().type)

                  if (!allowAutoStartAction) return

                  const { conversationId, newAction, oldAction } = actionPatch

                  const conversation = getContext().conversations.find(
                    conversation => conversation.id === conversationId
                  )

                  // this action only works when conversation is exists in the context
                  if (!conversation) return

                  logger.dev.log('auto start edit file action', {
                    conversation,
                    newAction,
                    oldAction
                  })

                  // stop old action
                  if (oldAction) {
                    const oldInlineDiffTask = oldAction.state?.inlineDiffTask
                    if (oldInlineDiffTask) {
                      await api
                        .actions()
                        .server.apply.abortAndCleanApplyCodeTask({
                          actionParams: {
                            task: oldInlineDiffTask
                          }
                        })
                    }
                  }

                  // start new action
                  await startActionMutation.mutateAsync({
                    conversation,
                    action: newAction,
                    chatContext: getContext()
                  })
                } catch (error) {
                  logAndToastError('Failed to start edit file action', error)
                }
              }
            } satisfies ActionPatchInput<EditFileAction>)
          }
        }

        if (
          result.type === 'xml' &&
          result.isBlockClosed &&
          result.tagName === 'V1Project'
        ) {
          const parsedInfo = result as V1ProjectTagInfo
          const projectName = parsedInfo.otherInfo.id || ''
          const presetName =
            parsedInfo.otherInfo.presetName || defaultPresetName
          const files: WebPreviewProjectFile[] =
            getWebPreviewProjectFilesFromParsedContents(
              getContext().conversations,
              conversation.id,
              projectName,
              parsedInfo.otherInfo.parseContents
            )

          if (projectName && files.length) {
            inputActions.push({
              relatedConversationContent: parsedInfo.content,
              action: {
                state: {},
                agent: {
                  id: uuidv4(),
                  name: AgentPluginId.WebPreview,
                  input: {
                    name: projectName,
                    presetName,
                    files
                  },
                  output: {
                    success: true
                  }
                }
              },
              onApplySuccess: async actionPatch => {
                try {
                  const { conversationId, newAction, oldAction } = actionPatch
                  const allowAutoStartAction = [ChatContextType.V1].includes(
                    getContext().type
                  )

                  if (!allowAutoStartAction) return

                  const conversation = getContext().conversations.find(
                    conversation => conversation.id === conversationId
                  )

                  if (!conversation) return

                  logger.dev.log('auto start web preview action', {
                    conversation,
                    newAction,
                    oldAction
                  })

                  // stop old action
                  if (oldAction) {
                    await stopPreviewMutation.mutateAsync()
                  }

                  const projectVersion = getWebPreviewProjectVersion(
                    getContext().conversations,
                    conversation.id,
                    projectName
                  )

                  // start new action
                  setProjectName(projectName)
                  setProjectVersion(projectVersion)
                  await openPreviewPage({
                    projectName,
                    projectVersion,
                    tab: 'preview'
                  })
                } catch (error) {
                  logAndToastError('Failed to start web preview action', error)
                }
              }
            } satisfies ActionPatchInput<WebPreviewAction>)
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
