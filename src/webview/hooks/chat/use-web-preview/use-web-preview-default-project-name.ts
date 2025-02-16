import { getDefaultWebPreviewProject } from '@shared/utils/chat-context-helper/common/web-preview-project'

import { useContextBySessionId } from '../use-context-by-session-id'

export interface UseWebPreviewDefaultProjectNameProps {
  sessionId?: string | null | undefined
}

export const useWebPreviewDefaultProjectName = (
  props: UseWebPreviewDefaultProjectNameProps
) => {
  const { sessionId } = props

  const { context } = useContextBySessionId({
    sessionId
  })

  const defaultProject = getDefaultWebPreviewProject(
    context?.conversations ?? []
  )
  const defaultProjectName = defaultProject?.name

  return {
    defaultProjectName
  }
}
