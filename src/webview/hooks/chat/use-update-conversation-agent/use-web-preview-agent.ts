import {
  ChatContextType,
  type Conversation,
  type WebPreviewProjectFile
} from '@shared/entities'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import type { WebPreviewAgent } from '@shared/plugins/agents/web-preview-agent-plugin/server/web-preview-agent'
import type { V1ProjectTagInfo } from '@shared/plugins/markdown/parsers'
import type { AgentPatchInput } from '@shared/utils/chat-context-helper/common/agent-utils'
import {
  getWebPreviewProjectFilesFromParsedContents,
  getWebPreviewProjectVersion
} from '@shared/utils/chat-context-helper/common/web-preview-project'
import { useChatWebPreviewContext } from '@webview/components/chat/web-preview/chat-web-preview-context'
import { useChatContext } from '@webview/contexts/chat-context'
import type { GetAgent } from '@webview/types/chat'
import { logAndToastError } from '@webview/utils/common'
import { logger } from '@webview/utils/logger'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'

export const useWebPreviewAgent = () => {
  const { t } = useTranslation()
  const { getContext } = useChatContext()
  const {
    openPreviewPage,
    setProjectName,
    setProjectVersion,
    stopPreviewMutation
  } = useChatWebPreviewContext()

  const createWebPreviewAgent = (
    parsedInfo: V1ProjectTagInfo,
    conversation: Conversation
  ): AgentPatchInput<GetAgent<WebPreviewAgent>> | null => {
    const defaultPresetName = getContext().settings.defaultV1PresetName
    const projectName = parsedInfo.otherInfo.id || ''
    const presetName = parsedInfo.otherInfo.presetName || defaultPresetName

    const files: WebPreviewProjectFile[] =
      getWebPreviewProjectFilesFromParsedContents(
        getContext().conversations,
        conversation.id,
        projectName,
        parsedInfo.otherInfo.parseContents
      )

    if (!projectName || !files.length) return null

    return {
      relatedConversationContent: parsedInfo.content,
      agent: {
        id: uuidv4(),
        name: AgentPluginId.WebPreview,
        type: 'normal',
        source: 'manual',
        input: {
          name: projectName,
          presetName,
          files
        },
        output: {
          success: true
        }
      },
      onApplySuccess: async agentPatch => {
        try {
          const { conversationId, newAgent, oldAgent } = agentPatch
          const allowAutoStartAgent = [ChatContextType.V1].includes(
            getContext().type
          )

          if (!allowAutoStartAgent) return

          const conversation = getContext().conversations.find(
            conversation => conversation.id === conversationId
          )
          if (!conversation) return

          logger.dev.log('auto start web preview agent', {
            conversation,
            newAgent,
            oldAgent
          })

          // stop old agent
          if (oldAgent) {
            await stopPreviewMutation.mutateAsync()
          }

          const projectVersion = getWebPreviewProjectVersion(
            getContext().conversations,
            conversation.id,
            projectName
          )

          // start new agent
          setProjectName(projectName)
          setProjectVersion(projectVersion)
          await openPreviewPage({
            projectName,
            projectVersion,
            tab: 'preview'
          })
        } catch (error) {
          logAndToastError(t('webview.actions.failedToStartWebPreview'), error)
        }
      }
    }
  }

  return createWebPreviewAgent
}
