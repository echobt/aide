import { useEffect } from 'react'
import { WebVM } from '@webview/components/webvm/webvm'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'

import { useChatWebPreviewContext } from './chat-web-preview-context'

export interface ChatWebPreviewProps {
  isFullScreen?: boolean
  onFullScreenChange?: (isFullScreen: boolean) => void
  allowAutoRestart?: boolean
}

export const ChatWebPreview = ({
  isFullScreen = false,
  onFullScreenChange,
  allowAutoRestart = false
}: ChatWebPreviewProps) => {
  const {
    sessionId,
    projectName,
    projectVersion,
    isCurrentSession,
    presetInfo,
    openPreviewPage,
    startPreviewMutation,
    preVersionFiles,

    // webvm
    url,
    setUrl,
    files,
    setFiles,
    activeFile,
    setActiveFile,
    activeTab,
    setActiveTab
  } = useChatWebPreviewContext()

  const hasFiles = files.length > 0
  const shouldStartPreview =
    sessionId &&
    projectName &&
    typeof projectVersion === 'number' &&
    presetInfo?.presetName &&
    allowAutoRestart &&
    hasFiles

  const getCurrentFiles = useCallbackRef(() => files)

  useEffect(() => {
    if (!shouldStartPreview) return

    startPreviewMutation.mutate(getCurrentFiles())
  }, [shouldStartPreview, getCurrentFiles])

  const handleFullscreenChange = async (isFullScreen: boolean) => {
    if (isFullScreen) {
      openPreviewPage({
        projectName
      })
    }

    onFullScreenChange?.(isFullScreen)
  }

  if (!projectName) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No project found</p>
      </div>
    )
  }

  return (
    <WebVM
      className="border-0 rounded-none h-full"
      url={url}
      setUrl={setUrl}
      activeFile={activeFile}
      setActiveFile={setActiveFile}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      files={files}
      setFiles={setFiles}
      preVersionFiles={preVersionFiles}
      readonly={!isCurrentSession}
      isFullScreen={isFullScreen}
      hideFullScreenButton={isFullScreen}
      onFullScreenChange={handleFullscreenChange}
      onRestartServer={async () => {
        await startPreviewMutation.mutateAsync(getCurrentFiles())
      }}
    />
  )
}
