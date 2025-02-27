import { useEffect, type FC } from 'react'
import { ChatWebPreview } from '@webview/components/chat/web-preview/chat-web-preview'
import {
  ChatWebPreviewProvider,
  useChatWebPreviewContext
} from '@webview/components/chat/web-preview/chat-web-preview-context'
import type { WebVMTab } from '@webview/components/webvm/webvm'
import { parseAsInteger, useQueryState } from '@webview/hooks/use-query-state'
import { useLocation } from 'react-router'

export default function WebPreviewPage() {
  // Get sessionId from URL query parameter
  const [sessionId] = useQueryState('sessionId')
  const location = useLocation()
  const isCurrentPage = location.pathname === '/web-preview'

  return (
    <ChatWebPreviewProvider value={{ sessionId }}>
      <div className="h-screen">
        <SyncRouteState />
        {sessionId && (
          <ChatWebPreview isFullScreen allowAutoRestart={isCurrentPage} />
        )}
      </div>
    </ChatWebPreviewProvider>
  )
}

const SyncRouteState: FC = () => {
  const [projectVersion] = useQueryState('projectVersion', parseAsInteger)
  const [projectName] = useQueryState('projectName')
  const [tab] = useQueryState('tab')
  const [activeFilePath] = useQueryState('activeFilePath')
  const [timestamp] = useQueryState('timestamp', parseAsInteger)

  const { setProjectVersion, setProjectName, setActiveTab, setActiveFilePath } =
    useChatWebPreviewContext()

  useEffect(() => {
    if (typeof projectVersion === 'number') {
      setProjectVersion(projectVersion)
    }
  }, [projectVersion])

  useEffect(() => {
    if (projectName && typeof projectName === 'string') {
      setProjectName(projectName)
    }
  }, [projectName])

  useEffect(() => {
    setActiveTab((tab || 'preview') as WebVMTab)
  }, [tab, timestamp])

  useEffect(() => {
    if (activeFilePath && typeof activeFilePath === 'string') {
      setActiveFilePath(activeFilePath)
    }
  }, [activeFilePath, timestamp])

  return null
}
