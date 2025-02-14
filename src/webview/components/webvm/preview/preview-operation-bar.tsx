import { useEffect, useState } from 'react'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { Input } from '@webview/components/ui/input'
import { Separator } from '@webview/components/ui/separator'
import { cn } from '@webview/utils/common'
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Maximize2,
  Minimize2,
  MonitorSmartphone,
  RefreshCw
} from 'lucide-react'

import { usePreviewContext } from './context/preview-context'

interface PreviewOperationBarProps {
  className?: string
}

export const PreviewOperationBar = ({
  className
}: PreviewOperationBarProps) => {
  const {
    url,
    setUrl,
    isFullScreen,
    isLoading,
    hideFullScreenButton,
    viewportSize,
    handleRefresh,
    handleBack,
    handleForward,
    toggleViewportSize,
    handleOpenInBrowser,
    handleFullscreenChange
  } = usePreviewContext()

  const [urlInput, setUrlInput] = useState(url)

  useEffect(() => {
    setUrlInput(url)
  }, [url])

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b bg-muted/50 px-2 py-2',
        className
      )}
    >
      <div className="flex items-center gap-1">
        <ButtonWithTooltip
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          tooltip="Back"
          onClick={handleBack}
        >
          <ChevronLeft className="h-4 w-4" />
        </ButtonWithTooltip>
        <ButtonWithTooltip
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          tooltip="Forward"
          onClick={handleForward}
        >
          <ChevronRight className="h-4 w-4" />
        </ButtonWithTooltip>
        <ButtonWithTooltip
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          tooltip="Refresh"
          onClick={handleRefresh}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </ButtonWithTooltip>
      </div>

      <Separator orientation="vertical" className="h-4" />

      {/* URL Bar */}
      <Input
        className="flex flex-1 items-center rounded-md bg-background px-2 py-1 text-sm"
        value={urlInput}
        placeholder="Enter URL"
        onChange={e => setUrlInput(e.target.value)}
        onBlur={() => setUrl(urlInput)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            setUrl(urlInput)
          }
        }}
      />

      <Separator orientation="vertical" className="h-4" />

      {/* Right Actions */}
      <div className="flex items-center gap-1">
        <ButtonWithTooltip
          variant="ghost"
          size="icon"
          tooltip={`Switch to ${
            viewportSize === 'desktop'
              ? 'mobile'
              : viewportSize === 'mobile'
                ? 'tablet'
                : 'desktop'
          } view`}
          onClick={() => toggleViewportSize(viewportSize)}
        >
          <MonitorSmartphone className="h-4 w-4" />
        </ButtonWithTooltip>

        <ButtonWithTooltip
          variant="ghost"
          size="icon"
          tooltip="Open in browser"
          onClick={handleOpenInBrowser}
        >
          <Globe className="h-4 w-4" />
        </ButtonWithTooltip>

        {!hideFullScreenButton && (
          <ButtonWithTooltip
            variant="ghost"
            size="icon"
            tooltip={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={() => handleFullscreenChange(!isFullScreen)}
          >
            {isFullScreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </ButtonWithTooltip>
        )}
      </div>
    </div>
  )
}
