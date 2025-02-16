import { useState } from 'react'

import { useWebPreviewDefaultProjectName } from './use-web-preview-default-project-name'

export const useWebPreviewProjectName = (sessionId?: string | null) => {
  const [projectName, setProjectName] = useState('')
  const [projectVersion, setProjectVersion] = useState<number | undefined>()

  const { defaultProjectName } = useWebPreviewDefaultProjectName({
    sessionId
  })

  const finalProjectName = projectName || defaultProjectName || ''

  return {
    projectName: finalProjectName,
    setProjectName,
    projectVersion,
    setProjectVersion
  }
}
