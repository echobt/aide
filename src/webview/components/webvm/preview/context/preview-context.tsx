import { createContext, useContext, useState, type ReactNode } from 'react'
import { api } from '@webview/network/actions-api'

export type ViewportSize = 'desktop' | 'mobile' | 'tablet'

interface PreviewContextValue {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  url: string
  setUrl: React.Dispatch<React.SetStateAction<string>>
  viewportSize: ViewportSize
  isFullScreen: boolean
  hideFullScreenButton: boolean
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  setViewportSize: (size: ViewportSize) => void
  handleRefresh: () => void
  handleBack: () => void
  handleForward: () => void
  toggleViewportSize: (size: ViewportSize) => void
  handleOpenInBrowser: () => void
  handleFullscreenChange: (isFullScreen: boolean) => void
}

const PreviewContext = createContext<PreviewContextValue | null>(null)

interface PreviewProviderProps {
  children: ReactNode
  value: Pick<
    PreviewContextValue,
    | 'url'
    | 'setUrl'
    | 'iframeRef'
    | 'isFullScreen'
    | 'handleFullscreenChange'
    | 'hideFullScreenButton'
  >
}

export const PreviewProvider = ({ children, value }: PreviewProviderProps) => {
  const { url, setUrl, iframeRef, isFullScreen, handleFullscreenChange } = value
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop')
  const [isLoading, setIsLoading] = useState(true)

  const handleRefresh = () => {
    setIsLoading(true)
    if (iframeRef.current && url) {
      // eslint-disable-next-line react-compiler/react-compiler
      iframeRef.current.src = url
    }
  }

  const handleBack = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.history.back()
    }
  }

  const handleForward = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.history.forward()
    }
  }

  const toggleViewportSize = () => {
    setViewportSize(prev =>
      prev === 'desktop' ? 'mobile' : prev === 'mobile' ? 'tablet' : 'desktop'
    )
  }

  const handleOpenInBrowser = async () => {
    if (iframeRef.current) {
      await api.actions().server.webvm.openInBrowser({
        actionParams: { url: iframeRef.current.src }
      })
    }
  }

  return (
    <PreviewContext.Provider
      value={{
        ...value,
        viewportSize,
        isLoading,
        url,
        setUrl,
        isFullScreen,
        setViewportSize,
        setIsLoading,
        handleRefresh,
        handleBack,
        handleForward,
        toggleViewportSize,
        handleOpenInBrowser,
        handleFullscreenChange
      }}
    >
      {children}
    </PreviewContext.Provider>
  )
}

export const usePreviewContext = () => {
  const context = useContext(PreviewContext)
  if (!context) {
    throw new Error('usePreviewContext must be used within a PreviewProvider')
  }
  return context
}
