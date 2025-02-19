import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import type { WebPreviewProjectFile } from '@shared/entities'
import {
  getAllWebPreviewProjects,
  getLatestWebPreviewProject
} from '@shared/utils/chat-context-helper/common/web-preview-project'
import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import type { OpenWebPreviewParams } from '@webview/actions/web-preview'
import type { WebVMTab } from '@webview/components/webvm/webvm'
import { useContextBySessionId } from '@webview/hooks/chat/use-context-by-session-id'
import { useWebPreviewActions } from '@webview/hooks/chat/use-web-preview/use-web-preview-actions'
import { useWebPreviewFiles } from '@webview/hooks/chat/use-web-preview/use-web-preview-files'
import { useWebPreviewProjectName } from '@webview/hooks/chat/use-web-preview/use-web-preview-project-name'
import { useWebPreviewVM } from '@webview/hooks/chat/use-web-preview/use-web-preview-vm'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'
import { api } from '@webview/network/actions-api'
import type { WebVMPresetInfo } from '@webview/types/chat'

interface ChatWebPreviewContextValue {
  sessionId: string
  projectName: string
  setProjectName: (name: string) => void
  projectVersion: number
  setProjectVersion: (version: number) => void
  setActiveFilePath: (filePath: string) => void
  enableSwitchDefaultPreset: boolean
  isCurrentSession: boolean
  presetInfo: WebVMPresetInfo | undefined
  versionsFiles: WebPreviewProjectFile[][]
  defaultVersion: number
  preVersionFiles: WebPreviewProjectFile[]
  presetName?: string
  // webvm
  files: WebPreviewProjectFile[]
  setFiles: React.Dispatch<React.SetStateAction<WebPreviewProjectFile[]>>
  url: string
  setUrl: React.Dispatch<React.SetStateAction<string>>
  activeFile: WebPreviewProjectFile | null
  setActiveFile: React.Dispatch<
    React.SetStateAction<WebPreviewProjectFile | null>
  >
  activeTab: WebVMTab
  setActiveTab: React.Dispatch<React.SetStateAction<WebVMTab>>

  // vm operations
  vmStatus: ReturnType<typeof useWebPreviewVM>['vmStatus']
  startPreviewMutation: ReturnType<
    typeof useWebPreviewVM
  >['startPreviewMutation']
  stopPreviewMutation: ReturnType<typeof useWebPreviewVM>['stopPreviewMutation']
  refreshStatus: ReturnType<typeof useWebPreviewVM>['refreshStatus']
  openPreviewPage: ReturnType<typeof useWebPreviewActions>['openPreviewPage']
}

const ChatWebPreviewContext = createContext<ChatWebPreviewContextValue | null>(
  null
)

interface ChatWebPreviewProviderProps {
  children: ReactNode
  value: {
    sessionId?: string | null | undefined
  }
}

export const ChatWebPreviewProvider = ({
  children,
  value
}: ChatWebPreviewProviderProps) => {
  const { sessionId: sessionIdFromProps } = value
  const [url, setUrl] = useState('')
  const [activeTab, setActiveTab] = useState<WebVMTab>('preview')
  const [activeFile, setActiveFile] = useState<WebPreviewProjectFile | null>(
    null
  )

  const { context, finalSessionId, isCurrentSession } = useContextBySessionId({
    sessionId: sessionIdFromProps
  })

  const defaultPresetName = context?.settings.defaultV1PresetName

  // Project name management
  const {
    projectName,
    setProjectName,
    projectVersion: initProjectVersion,
    setProjectVersion
  } = useWebPreviewProjectName(sessionIdFromProps)

  // Files management
  const {
    files,
    setFiles,
    currentVersion: projectVersion,
    preVersionFiles,
    versionsFiles,
    defaultVersion
  } = useWebPreviewFiles(finalSessionId, projectName, initProjectVersion)

  const latestWebPreviewProject = getLatestWebPreviewProject(
    context?.conversations ?? [],
    projectName
  )
  const presetName = latestWebPreviewProject?.presetName ?? defaultPresetName

  // VM operations
  const vmStatusParams = {
    projectName,
    sessionId: finalSessionId,
    presetName
  }

  const { startPreviewMutation, stopPreviewMutation, vmStatus, refreshStatus } =
    useWebPreviewVM(vmStatusParams, false)

  const openPreviewPage = async (
    params: Omit<OpenWebPreviewParams, 'sessionId' | 'toastMessage'>
  ) => {
    await api.actions().server.webvm.openWebviewForFullScreen({
      actionParams: {
        sessionId: finalSessionId,
        ...params
      }
    })
  }

  // Preset info
  const { data: presetInfo } = useQuery({
    queryKey: ['web-preview-preset-info', { presetName }],
    queryFn: ({ signal }) =>
      api.actions().server.webvm.getPresetInfo({
        abortController: signalToController(signal),
        actionParams: { presetName: presetName! }
      }),
    enabled: Boolean(presetName)
  })

  // URL sync
  useEffect(() => {
    setUrl(vmStatus?.previewUrl || '')
  }, [vmStatus?.previewUrl])

  const getFiles = useCallbackRef(() => files)
  const setActiveFilePath = (filePath: string) => {
    const file = getFiles().find(file => file.path === filePath)
    if (file) {
      setActiveTab('code')
      setActiveFile(file)
    }
  }

  const enableSwitchDefaultPreset =
    getAllWebPreviewProjects(context?.conversations || []).length < 1

  return (
    <ChatWebPreviewContext.Provider
      value={{
        sessionId: finalSessionId,
        projectName,
        setProjectName,
        projectVersion,
        setProjectVersion,
        setActiveFilePath,
        enableSwitchDefaultPreset,
        isCurrentSession,
        presetInfo,
        versionsFiles,
        defaultVersion,
        preVersionFiles,
        presetName,
        // webvm
        url,
        setUrl,
        files,
        setFiles,
        activeTab,
        setActiveTab,
        activeFile,
        setActiveFile,
        // vm operations
        startPreviewMutation,
        stopPreviewMutation,
        vmStatus,
        refreshStatus,
        openPreviewPage
      }}
    >
      {children}
    </ChatWebPreviewContext.Provider>
  )
}

export const useChatWebPreviewContext = () => {
  const context = useContext(ChatWebPreviewContext)
  if (!context) {
    throw new Error(
      'useChatWebPreviewContext must be used within a ChatWebPreviewProvider'
    )
  }
  return context
}
