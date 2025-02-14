import { useEffect, type FC } from 'react'
import { ChatWebPreview } from '@webview/components/chat/web-preview/chat-web-preview'
import {
  ChatWebPreviewProvider,
  useChatWebPreviewContext
} from '@webview/components/chat/web-preview/chat-web-preview-context'
import type { WebVMTab } from '@webview/components/webvm/webvm'
import { useLocation, useSearchParams } from 'react-router'

export default function WebPreviewPage() {
  // Get sessionId from URL query parameter
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const location = useLocation()
  const isCurrentPage = location.pathname === '/web-preview'

  return (
    <ChatWebPreviewProvider value={{ sessionId }}>
      <div className="h-screen">
        <SyncRouteState />
        <ChatWebPreview isFullScreen allowAutoRestart={isCurrentPage} />
      </div>
    </ChatWebPreviewProvider>
  )
}

const SyncRouteState: FC = () => {
  const [searchParams] = useSearchParams()
  const projectVersion =
    parseInt(searchParams.get('projectVersion') || '', 10) || null
  const projectName = searchParams.get('projectName')
  const tab = searchParams.get('tab') as WebVMTab | null
  const activeFilePath = searchParams.get('activeFilePath') || null

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
    if (tab && typeof tab === 'string') {
      setActiveTab(tab)
    }
  }, [tab])

  useEffect(() => {
    if (activeFilePath && typeof activeFilePath === 'string') {
      setActiveFilePath(activeFilePath)
    }
  }, [activeFilePath])

  return null
}
