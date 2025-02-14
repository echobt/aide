import { useEffect } from 'react'
import { cn } from '@webview/utils/common'

import { usePreviewContext } from './context/preview-context'

interface PreviewContentProps {
  className?: string
}

export const PreviewContent = ({ className }: PreviewContentProps) => {
  const { viewportSize, setIsLoading, url, iframeRef } = usePreviewContext()

  useEffect(() => {
    if (!url) {
      setIsLoading(false)
    }
  }, [url, setIsLoading])

  return (
    <div className={cn('relative overflow-auto bg-background/50', className)}>
      <div
        className={cn(
          'mx-auto h-full transition-all duration-200',
          viewportSize === 'mobile'
            ? 'w-[390px]'
            : viewportSize === 'tablet'
              ? 'w-[768px]'
              : 'w-full'
        )}
      >
        {/* Web Content */}
        {!url ? (
          <div className="h-full w-full flex-1 border-none" />
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            className="h-full w-full flex-1 border-none"
            allowFullScreen
            title="webvm"
            onLoad={() => setIsLoading(false)}
            allow="accelerometer; autoplay; camera; clipboard-write; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; payment; picture-in-picture; usb; vr; xr-spatial-tracking"
            sandbox="allow-downloads allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation allow-top-navigation-by-user-activation"
          />
        )}
      </div>
    </div>
  )
}
