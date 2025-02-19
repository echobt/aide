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
  Monitor,
  RotateCw,
  Smartphone,
  TabletSmartphone
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

  // Add URL correction function
  const correctAndSetUrl = (inputUrl: string) => {
    let correctedUrl = inputUrl.trim()

    // Check if URL has a protocol
    if (
      !correctedUrl.startsWith('http://') &&
      !correctedUrl.startsWith('https://')
    ) {
      // Add https:// if URL doesn't have a protocol
      correctedUrl = `https://${correctedUrl}`
    }

    setUrl(correctedUrl)
  }

  // Helper function to get viewport icon
  const getViewportIcon = () => {
    switch (viewportSize) {
      case 'mobile':
        return <Smartphone className="size-4" />
      case 'tablet':
        return <TabletSmartphone className="size-4" />
      default:
        return <Monitor className="size-4" />
    }
  }

  return (
    <div
      className={cn('flex items-center gap-2 border-b px-2 py-2', className)}
    >
      <div className="flex items-center gap-1">
        <ButtonWithTooltip
          variant="ghost"
          size="iconSm"
          tooltip="Back"
          onClick={handleBack}
        >
          <ChevronLeft className="size-4" />
        </ButtonWithTooltip>
        <ButtonWithTooltip
          variant="ghost"
          size="iconSm"
          tooltip="Forward"
          onClick={handleForward}
        >
          <ChevronRight className="size-4" />
        </ButtonWithTooltip>
        <ButtonWithTooltip
          variant="ghost"
          size="iconSm"
          tooltip="Refresh"
          onClick={handleRefresh}
        >
          <RotateCw className={cn('size-4', isLoading && 'animate-spin')} />
        </ButtonWithTooltip>
      </div>

      <Separator orientation="vertical" className="h-4" />

      {/* URL Bar */}
      <Input
        className="flex flex-1 items-center rounded-md bg-background px-2 py-1 text-sm"
        value={urlInput}
        placeholder="Enter URL"
        onChange={e => setUrlInput(e.target.value)}
        onBlur={() => correctAndSetUrl(urlInput)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            correctAndSetUrl(urlInput)
          }
        }}
      />

      <Separator orientation="vertical" className="h-4" />

      {/* Right Actions */}
      <div className="flex items-center gap-1">
        <ButtonWithTooltip
          variant="ghost"
          size="iconSm"
          tooltip={`Switch to ${
            viewportSize === 'desktop'
              ? 'mobile'
              : viewportSize === 'mobile'
                ? 'tablet'
                : 'desktop'
          } view`}
          onClick={() => toggleViewportSize(viewportSize)}
        >
          {getViewportIcon()}
        </ButtonWithTooltip>

        <ButtonWithTooltip
          variant="ghost"
          size="iconSm"
          tooltip="Open in browser"
          onClick={handleOpenInBrowser}
        >
          <Globe className="size-4" />
        </ButtonWithTooltip>

        {!hideFullScreenButton && (
          <ButtonWithTooltip
            variant="ghost"
            size="iconSm"
            tooltip={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={() => handleFullscreenChange(!isFullScreen)}
          >
            {isFullScreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </ButtonWithTooltip>
        )}
      </div>
    </div>
  )
}
