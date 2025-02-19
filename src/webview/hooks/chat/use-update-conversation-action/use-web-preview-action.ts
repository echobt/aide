import {
  ChatContextType,
  type Conversation,
  type WebPreviewProjectFile
} from '@shared/entities'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import type { WebPreviewAction } from '@shared/plugins/agents/web-preview-agent-plugin/types'
import type { V1ProjectTagInfo } from '@shared/plugins/markdown/parsers'
import type { ActionPatchInput } from '@shared/utils/chat-context-helper/common/action-utils'
import {
  getWebPreviewProjectFilesFromParsedContents,
  getWebPreviewProjectVersion
} from '@shared/utils/chat-context-helper/common/web-preview-project'
import { useChatWebPreviewContext } from '@webview/components/chat/web-preview/chat-web-preview-context'
import { useChatContext } from '@webview/contexts/chat-context'
import { logAndToastError } from '@webview/utils/common'
import { logger } from '@webview/utils/logger'
import { v4 as uuidv4 } from 'uuid'

export const useWebPreviewAction = () => {
  const { getContext } = useChatContext()
  const {
    openPreviewPage,
    setProjectName,
    setProjectVersion,
    stopPreviewMutation
  } = useChatWebPreviewContext()

  const createWebPreviewAction = (
    parsedInfo: V1ProjectTagInfo,
    conversation: Conversation
  ): ActionPatchInput<WebPreviewAction> | null => {
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
    }
  }

  return createWebPreviewAction
}
