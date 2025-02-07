import { useEffect } from 'react'
import { ChatContextType } from '@shared/entities'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import type { EditFileAction } from '@shared/plugins/agents/edit-file-agent-plugin/types'
import { useMarkdownActionContext } from '@webview/components/chat/messages/markdown/markdown-action-context'
import { useChatContext } from '@webview/contexts/chat-context'
import { useSessionActionContext } from '@webview/contexts/conversation-action-context/session-action-context'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { logger } from '@webview/utils/logger'
import { v4 as uuidv4 } from 'uuid'

interface ActionControllerProps {
  codeBlockContent: string
  fileSchemeUri: string
  isBlockClosed: boolean
}

export const ActionController: React.FC<ActionControllerProps> = ({
  codeBlockContent,
  fileSchemeUri,
  isBlockClosed
}) => {
  const { addAction } = useMarkdownActionContext()
  const { context, getContext } = useChatContext()
  const { startActionMutation } = useSessionActionContext()

  const allowAutoStartAction = [
    ChatContextType.Composer,
    ChatContextType.Agent
  ].includes(context.type)

  useEffect(() => {
    // add file edit action
    if (!isBlockClosed || !fileSchemeUri) return

    addAction<EditFileAction>({
      currentContent: codeBlockContent,
      action: {
        state: {
          inlineDiffTask: null
        },
        agent: {
          id: uuidv4(),
          name: AgentPluginId.EditFile,
          input: {
            blocking: false,
            codeEdit: codeBlockContent,
            instructions: 'Edit the file by composer',
            targetFilePath: fileSchemeUri
          },
          output: {
            success: true
          }
        }
      },
      onSuccess: async ({ conversationId, action, oldAction }) => {
        try {
          if (!allowAutoStartAction) return

          const conversation = getContext().conversations.find(
            conversation => conversation.id === conversationId
          )

          if (!conversation) return

          logger.dev.log('auto start action', {
            conversation,
            action,
            oldAction
          })

          // stop old action
          if (oldAction) {
            const oldInlineDiffTask = oldAction.state?.inlineDiffTask
            if (oldInlineDiffTask) {
              await api.actions().server.apply.abortAndCleanApplyCodeTask({
                actionParams: {
                  task: oldInlineDiffTask
                }
              })
            }
          }

          // start new action
          await startActionMutation.mutateAsync({
            conversation,
            action,
            chatContext: getContext()
          })
        } catch (error) {
          logAndToastError(
            'Failed to start action when closing code block',
            error
          )
        }
      }
    })
  }, [
    codeBlockContent,
    fileSchemeUri,
    isBlockClosed,
    allowAutoStartAction,
    getContext
  ])

  return null
}
