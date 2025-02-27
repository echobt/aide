import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import { openLink } from '@webview/utils/api'
import { useImmer } from 'use-immer'

export type ViewportSize = 'desktop' | 'mobile' | 'tablet'

interface PreviewContextValue {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  iframeKey: string
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
    | 'iframeKey'
    | 'isFullScreen'
    | 'handleFullscreenChange'
    | 'hideFullScreenButton'
  >
}

const isLocalhost = (url: string) =>
  ['localhost', '127.0.0.1'].some(host => url.includes(host))

export const PreviewProvider = ({ children, value }: PreviewProviderProps) => {
  const { url, setUrl, iframeRef, isFullScreen, handleFullscreenChange } = value
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop')
  const [isLoading, setIsLoading] = useState(true)
  const [localHistory, setLocalHistory] = useImmer<string[]>([])

  const handleRefresh = () => {
    setIsLoading(true)
    if (iframeRef.current && url) {
      // eslint-disable-next-line react-compiler/react-compiler
      iframeRef.current.src = url
    }
  }

  const handleBack = () => {
    if (!iframeRef.current) return

    if (isLocalhost(url)) {
      // For localhost, use postMessage
      iframeRef.current.contentWindow?.postMessage(
        {
          type: 'HISTORY_BACK'
        },
        '*'
      )
    } else {
      const lastLocalHistory = localHistory?.at(-1)
      if (lastLocalHistory) {
        setUrl(lastLocalHistory)
        setLocalHistory(draft => {
          draft.pop()
        })
      }
    }
  }

  const handleForward = () => {
    if (!iframeRef.current) return

    if (isLocalhost(url)) {
      // For localhost, use postMessage
      iframeRef.current.contentWindow?.postMessage(
        {
          type: 'HISTORY_FORWARD'
        },
        '*'
      )
    }
  }

  useEffect(() => {
    const lastLocalHistory = localHistory?.at(-1)
    if (isLocalhost(url) && lastLocalHistory !== url) {
      setLocalHistory(draft => {
        draft.push(url)
      })
    }
  }, [url])

  const toggleViewportSize = () => {
    setViewportSize(prev =>
      prev === 'desktop' ? 'mobile' : prev === 'mobile' ? 'tablet' : 'desktop'
    )
  }

  const handleOpenInBrowser = async () => {
    if (!iframeRef.current) return

    await openLink(iframeRef.current.src)
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
