import type { WebPreviewProjectFile } from '@shared/entities'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { getWebPreviewProjectVersionsFiles } from '@shared/utils/chat-context-helper/common/web-preview-project'
import { useChatContext } from '@webview/contexts/chat-context'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'

import { useContextBySessionId } from '../use-context-by-session-id'

export const useWebPreviewFiles = (
  sessionId: string,
  projectName: string,
  projectVersion?: number
) => {
  const { setContext } = useChatContext()
  const { context, isCurrentSession } = useContextBySessionId({ sessionId })
  const conversations = context?.conversations ?? []

  const versionsFiles = getWebPreviewProjectVersionsFiles(
    conversations,
    projectName
  )
  const lastVersion = versionsFiles.length > 0 ? versionsFiles.length - 1 : 0
  const defaultVersion = !projectName || !conversations.length ? 0 : lastVersion

  const updateFiles = (
    projectName: string,
    projectVersion: number,
    newFiles: WebPreviewProjectFile[]
  ) => {
    if (!isCurrentSession) return

    setContext(draft => {
      let currentVersionIndex = -1
      draft.conversations.forEach(conversation => {
        const webPreviewProject = conversation.agents?.find(
          agent =>
            agent.name === AgentPluginId.WebPreview &&
            agent.input.name === projectName
        )

        if (webPreviewProject) {
          currentVersionIndex += 1

          if (currentVersionIndex === projectVersion) {
            webPreviewProject.input.files = newFiles
          }
        }
      })
    })
  }

  const currentVersion = projectVersion ?? defaultVersion
  const currentVersionFiles = versionsFiles[currentVersion] || []
  const preVersionFiles = versionsFiles[currentVersion - 1] || []

  const getCurrentVersionFiles = useCallbackRef(() => currentVersionFiles)
  const setFiles: React.Dispatch<
    React.SetStateAction<WebPreviewProjectFile[]>
  > = files => {
    const currentVersionFiles = getCurrentVersionFiles()
    if (typeof files === 'function') {
      updateFiles(projectName, currentVersion, files(currentVersionFiles))
    } else {
      updateFiles(projectName, currentVersion, files)
    }
  }

  return {
    files: currentVersionFiles,
    setFiles,
    preVersionFiles,
    currentVersion,
    versionsFiles,
    defaultVersion
  }
}
