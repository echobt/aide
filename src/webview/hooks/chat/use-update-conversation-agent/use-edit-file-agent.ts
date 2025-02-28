import { ChatContextType } from '@shared/entities'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import type { EditFileAgent } from '@shared/plugins/agents/edit-file-agent-plugin/server/edit-file-agent'
import type { MDCodeInfo } from '@shared/plugins/markdown/parsers'
import type { AgentPatchInput } from '@shared/utils/chat-context-helper/common/agent-utils'
import { useChatContext } from '@webview/contexts/chat-context'
import { useSessionAgentContext } from '@webview/contexts/conversation-agent-context/session-agent-context'
import { api } from '@webview/network/actions-api'
import type { GetAgent } from '@webview/types/chat'
import { logAndToastError } from '@webview/utils/common'
import { logger } from '@webview/utils/logger'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'

export const useEditFileAgent = () => {
  const { t } = useTranslation()
  const { getContext } = useChatContext()
  const { startAgentMutation } = useSessionAgentContext()

  const createEditFileAgent = (
    parsedInfo: MDCodeInfo
  ): AgentPatchInput<GetAgent<EditFileAgent>> | null => {
    const filePath = parsedInfo.otherInfo?.filePath
    if (!filePath) return null

    return {
      relatedConversationContent: parsedInfo.content,
      agent: {
        id: uuidv4(),
        name: AgentPluginId.EditFile,
        type: 'normal',
        source: 'manual',
        input: {
          blocking: false,
          codeEdit: parsedInfo.content,
          instructions: t('webview.actions.editFileByComposer'),
          targetFilePath: filePath
        },
        output: {
          codeEditTask: null
        }
      },
      onApplySuccess: async agentPatch => {
        try {
          const allowAutoStartAgent = [
            ChatContextType.Composer,
            ChatContextType.Agent
          ].includes(getContext().type)

          if (!allowAutoStartAgent) return

          const { conversationId, newAgent, oldAgent } = agentPatch
          const conversation = getContext().conversations.find(
            conversation => conversation.id === conversationId
          )
          if (!conversation) return

          logger.dev.log('auto start edit file agent', {
            conversation,
            newAgent,
            oldAgent
          })

          // stop old agent
          if (oldAgent?.output?.codeEditTask) {
            await api.actions().server.apply.abortAndCleanApplyCodeTask({
              actionParams: {
                task: oldAgent.output.codeEditTask
              }
            })
          }

          // start new agent
          await startAgentMutation.mutateAsync({
            conversationId,
            agentId: newAgent.id,
            sessionId: getContext().id
          })
        } catch (error) {
          logAndToastError(t('webview.actions.failedToStartEditFile'), error)
        }
      }
    }
  }

  return createEditFileAgent
}
