import { ChatContextType } from '@shared/entities'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import type { EditFileAction } from '@shared/plugins/agents/edit-file-agent-plugin/types'
import type { MDCodeInfo } from '@shared/plugins/markdown/parsers'
import type { ActionPatchInput } from '@shared/utils/chat-context-helper/common/action-utils'
import { useChatContext } from '@webview/contexts/chat-context'
import { useSessionActionContext } from '@webview/contexts/conversation-action-context/session-action-context'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { logger } from '@webview/utils/logger'
import { v4 as uuidv4 } from 'uuid'

export const useEditFileAction = () => {
  const { getContext } = useChatContext()
  const { startActionMutation } = useSessionActionContext()

  const createEditFileAction = (
    parsedInfo: MDCodeInfo
  ): ActionPatchInput<EditFileAction> | null => {
    const filePath = parsedInfo.otherInfo?.filePath
    if (!filePath) return null

    return {
      relatedConversationContent: parsedInfo.content,
      action: {
        state: {
          codeEditTask: null
        },
        agent: {
          id: uuidv4(),
          name: AgentPluginId.EditFile,
          type: 'normal',
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
          if (!conversation) return

          logger.dev.log('auto start edit file action', {
            conversation,
            newAction,
            oldAction
          })

          // stop old action
          if (oldAction?.state?.codeEditTask) {
            await api.actions().server.apply.abortAndCleanApplyCodeTask({
              actionParams: {
                task: oldAction.state.codeEditTask
              }
            })
          }

          // start new action
          await startActionMutation.mutateAsync({
            conversationId,
            actionId: newAction.id,
            sessionId: getContext().id
          })
        } catch (error) {
          logAndToastError('Failed to start edit file action', error)
        }
      }
    }
  }

  return createEditFileAction
}
