import type { ChatContext } from '@shared/entities'
import { getWebPreviewProjectVersionsFiles } from '@shared/utils/chat-context-helper/common/web-preview-project'

export interface UseWebPreviewDefaultProjectVersionProps {
  projectName: string | undefined | null
  context: ChatContext | undefined | null
}

export const useWebPreviewDefaultProjectVersion = (
  props: UseWebPreviewDefaultProjectVersionProps
) => {
  const { projectName, context } = props
  const versionsFiles = getWebPreviewProjectVersionsFiles(
    context?.conversations ?? [],
    projectName || ''
  )
  const lastVersion = versionsFiles.length > 0 ? versionsFiles.length - 1 : 0
  const defaultVersion = !projectName || !context ? 0 : lastVersion

  return {
    defaultVersion
  }
}
