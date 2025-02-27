import { useRef } from 'react'
import type { WebPreviewProjectFile } from '@shared/entities'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@webview/components/ui/tabs'
import { CodeXmlIcon, Eye, RefreshCcw, SquareTerminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ButtonWithTooltip } from '../button-with-tooltip'
import { Code } from './code'
import { CodeEditorProvider } from './code/context/code-editor-context'
import { CodeExplorerProvider } from './code/context/code-explorer-context'
import { Console } from './console'
import { ConsoleProvider } from './console/context/console-context'
import { Preview } from './preview'
import { PreviewProvider } from './preview/context/preview-context'

export type WebVMTab = 'preview' | 'code' | 'console'

export interface WebVMProps {
  className?: string

  url: string
  setUrl: React.Dispatch<React.SetStateAction<string>>
  files: WebPreviewProjectFile[]
  setFiles: React.Dispatch<React.SetStateAction<WebPreviewProjectFile[]>>
  activeFile: WebPreviewProjectFile | null
  setActiveFile: React.Dispatch<
    React.SetStateAction<WebPreviewProjectFile | null>
  >
  activeTab: WebVMTab
  setActiveTab: React.Dispatch<React.SetStateAction<WebVMTab>>

  isStartingServer: boolean
  preVersionFiles: WebPreviewProjectFile[]
  readonly?: boolean
  hideFullScreenButton?: boolean
  isFullScreen: boolean
  onFullScreenChange: (isFullScreen: boolean) => void
  onRestartServer?: () => void
}

export const WebVM = ({
  className,

  url,
  setUrl,
  files,
  setFiles,
  activeFile,
  setActiveFile,
  activeTab,
  setActiveTab,

  isStartingServer,
  preVersionFiles,
  readonly = false,
  hideFullScreenButton = false,
  isFullScreen = false,
  onFullScreenChange,
  onRestartServer
}: WebVMProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { t } = useTranslation()

  return (
    <div
      className={`flex flex-col flex-1 overflow-hidden rounded-lg border bg-background shadow-sm ${className}`}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value: string) =>
          setActiveTab(value as 'preview' | 'code' | 'console')
        }
        className="flex-1 flex flex-col"
      >
        <div className="flex items-center justify-between gap-2 border-b px-2">
          <TabsList className="h-10 bg-transparent">
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t('webview.webvm.tabs.preview')}
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center gap-2">
              <CodeXmlIcon className="h-4 w-4" />
              {t('webview.webvm.tabs.code')}
            </TabsTrigger>
            <TabsTrigger value="console" className="flex items-center gap-2">
              <SquareTerminal className="h-4 w-4" />
              {t('webview.webvm.tabs.console')}
            </TabsTrigger>
          </TabsList>

          {onRestartServer && (
            <ButtonWithTooltip
              variant="outline"
              size="sm"
              tooltip={t('webview.webvm.restartServer')}
              onClick={onRestartServer}
              disabled={isStartingServer}
            >
              <RefreshCcw
                className={`h-4 w-4 ${isStartingServer ? 'animate-spin' : ''}`}
              />
              {t('webview.webvm.restartServer')}
            </ButtonWithTooltip>
          )}
        </div>

        <TabsContent
          value="preview"
          forceMount
          className="flex-1 data-[state=inactive]:hidden mt-0 border-0 overflow-auto"
        >
          <PreviewProvider
            value={{
              url,
              setUrl,
              iframeRef,
              hideFullScreenButton,
              isFullScreen,
              handleFullscreenChange: onFullScreenChange
            }}
          >
            <Preview />
          </PreviewProvider>
        </TabsContent>

        <TabsContent
          value="code"
          forceMount
          className="flex-1 data-[state=inactive]:hidden mt-0 border-0 overflow-auto"
        >
          <CodeExplorerProvider
            value={{
              files,
              setFiles,
              preVersionFiles,
              readonly,
              activeFile,
              setActiveFile
            }}
          >
            <CodeEditorProvider value={{}}>
              <Code />
            </CodeEditorProvider>
          </CodeExplorerProvider>
        </TabsContent>

        <TabsContent
          value="console"
          forceMount
          className="flex-1 data-[state=inactive]:hidden mt-0 border-0 overflow-auto"
        >
          <ConsoleProvider value={{ url, iframeRef }}>
            <Console />
          </ConsoleProvider>
        </TabsContent>
      </Tabs>
    </div>
  )
}
