import type {
  Conversation,
  WebPreviewProject,
  WebPreviewProjectFile
} from '@shared/entities'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import type { V1ProjectContent } from '@shared/plugins/markdown/parsers'
import { removeDuplicates } from '@shared/utils/common'

export const getLatestWebPreviewProject = (
  conversations: Conversation[],
  projectName: string
) =>
  conversations.reduce(
    (acc, conversation) => {
      const webPreviewProject = conversation.actions.find(
        action =>
          action.agent?.name === AgentPluginId.WebPreview &&
          action.agent?.input.name === projectName
      )?.agent?.input

      if (webPreviewProject) return webPreviewProject

      return acc
    },
    null as WebPreviewProject | null
  )

export const getWebPreviewProjectVersionsFiles = (
  conversations: Conversation[],
  projectName: string
) =>
  conversations.reduce((acc, conversation) => {
    const webPreviewProject = conversation.actions.find(
      action =>
        action.agent?.name === AgentPluginId.WebPreview &&
        action.agent?.input.name === projectName
    )

    if (webPreviewProject) acc.push(webPreviewProject.agent?.input.files)

    return acc
  }, [] as WebPreviewProjectFile[][])

export const getAllWebPreviewProjects = (conversations: Conversation[]) =>
  conversations.reduce((acc, conversation) => {
    const webPreviewProject = conversation.actions.find(
      action => action.agent?.name === AgentPluginId.WebPreview
    )

    if (webPreviewProject) acc.push(webPreviewProject.agent?.input)
    return acc
  }, [] as WebPreviewProject[])

export const getDefaultWebPreviewProject = (conversations: Conversation[]) =>
  getAllWebPreviewProjects(conversations).at(-1)

export const getWebPreviewProjectFilesFromParsedContents = (
  conversations: Conversation[],
  currentConversationId: string,
  projectName: string,
  currentV1ProjectContents: V1ProjectContent[]
) => {
  const projectFiles: WebPreviewProjectFile[] = []
  let preVersionFiles: WebPreviewProjectFile[] = []

  // get previous version files
  const currentConversationIndex = conversations.findIndex(
    conversation => conversation.id === currentConversationId
  )

  for (let i = conversations.length - 1; i >= 0; i--) {
    const conversation = conversations[i]!

    if (currentConversationIndex === -1 || i < currentConversationIndex) {
      const targetAction = conversation.actions.find(
        action =>
          action.agent?.name === AgentPluginId.WebPreview &&
          action.agent?.input.name === projectName
      )

      if (targetAction) {
        preVersionFiles = [...(targetAction.agent?.input.files || [])]
        break
      }
    }
  }

  currentV1ProjectContents?.forEach(contentInfo => {
    if (contentInfo.type === 'code') {
      const path =
        contentInfo.otherInfo?.v1ProjectFilePath ||
        contentInfo.otherInfo?.filePath ||
        ''

      if (path) {
        projectFiles.push({
          content: contentInfo.content,
          path
        })
      }
    }

    if (contentInfo.type === 'xml') {
      // Apply patches based on XML operations
      switch (contentInfo.tagName) {
        case 'MoveFile': {
          const { fromFilePath, toFilePath } = contentInfo.otherInfo
          if (fromFilePath && toFilePath) {
            // Find the file in preVersionFiles and update its path
            const fileIndex = preVersionFiles.findIndex(
              f => f.path === fromFilePath
            )
            if (fileIndex !== -1) {
              const movedFile = {
                ...preVersionFiles[fileIndex]!,
                path: toFilePath
              }
              projectFiles.push(movedFile)
            }
          }
          break
        }
        case 'DeleteFile': {
          const { filePath } = contentInfo.otherInfo
          if (filePath) {
            // Remove the file from projectFiles if it exists
            const fileIndex = projectFiles.findIndex(f => f.path === filePath)
            if (fileIndex !== -1) {
              projectFiles.splice(fileIndex, 1)
            }
          }
          break
        }
        case 'QuickEdit': {
          const { filePath, fileContent } = contentInfo.otherInfo
          if (filePath && fileContent) {
            // Update or add the file with new content
            const fileIndex = projectFiles.findIndex(f => f.path === filePath)
            if (fileIndex !== -1) {
              projectFiles[fileIndex] = { path: filePath, content: fileContent }
            } else {
              projectFiles.push({ path: filePath, content: fileContent })
            }
          }
          break
        }
        default:
          break
      }
    }
  })

  return removeDuplicates(projectFiles, ['path'])
}

export const getWebPreviewProjectVersion = (
  conversations: Conversation[],
  currentConversationId: string,
  projectName: string
) => {
  let projectVersion = 0

  for (let i = 0; i < conversations.length; i++) {
    const conversation = conversations[i]!

    if (conversation.id === currentConversationId) {
      break
    }

    if (
      conversation.actions.some(
        action =>
          action.agent?.name === AgentPluginId.WebPreview &&
          action.agent?.input.name === projectName
      )
    ) {
      projectVersion++
    }
  }

  return projectVersion
}
