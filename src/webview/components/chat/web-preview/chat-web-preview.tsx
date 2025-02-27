import { useEffect, useRef } from 'react'
import { WebVM, type WebVMRef } from '@webview/components/webvm/webvm'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const webvmRef = useRef<WebVMRef>(null)
  const {
    sessionId,
    projectName,
    projectVersion,
    isCurrentSession,
    presetName,
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
  const getCurrentFiles = useCallbackRef(() => files)

  useEffect(() => {
    const shouldStartPreview =
      sessionId &&
      projectName &&
      typeof projectVersion === 'number' &&
      presetName &&
      allowAutoRestart &&
      hasFiles

    if (!shouldStartPreview) return

    startPreviewMutation.mutate(getCurrentFiles())
  }, [
    sessionId,
    projectName,
    projectVersion,
    presetName,
    allowAutoRestart,
    hasFiles,
    getCurrentFiles,
    startPreviewMutation.mutate
  ])

  useEffect(() => {
    if (startPreviewMutation.status === 'success') {
      webvmRef.current?.refreshIframe()
    }
  }, [startPreviewMutation.status])

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
        <p className="text-sm text-muted-foreground">
          {t('webview.webPreview.noProjectFound')}
        </p>
      </div>
    )
  }

  return (
    <WebVM
      ref={webvmRef}
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
      isStartingServer={startPreviewMutation.isPending}
      isFullScreen={isFullScreen}
      hideFullScreenButton={isFullScreen}
      onFullScreenChange={handleFullscreenChange}
      onRestartServer={async () => {
        await startPreviewMutation.mutateAsync(getCurrentFiles())
      }}
    />
  )
}
