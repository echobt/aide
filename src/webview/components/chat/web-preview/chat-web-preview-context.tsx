import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react'
import { defaultPresetName as _defaultPresetName } from '@extension/registers/webvm-register/presets/_base/constants'
import type { WebPreviewProjectFile } from '@shared/entities'
import { getAllWebPreviewProjects } from '@shared/utils/chat-context-helper/common/web-preview-project'
import type { WebVMTab } from '@webview/components/webvm/webvm'
import { useChatContext } from '@webview/contexts/chat-context'
import { useWebPreviewDefaultProjectName } from '@webview/hooks/chat/use-web-preview-default-project-name'
import { useWebPreviewProject } from '@webview/hooks/chat/use-web-preview-project'

type WebPreviewProjectReturns = ReturnType<typeof useWebPreviewProject>

interface ChatWebPreviewContextValue extends WebPreviewProjectReturns {
  sessionId: string
  defaultPresetName: string
  setDefaultPresetName: (name: string) => void
  projectName: string
  setProjectName: (name: string) => void
  projectVersion: number
  setProjectVersion: (version: number) => void
  setActiveFilePath: (filePath: string) => void
  enableSwitchDefaultPreset: boolean

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
  const [defaultPresetName, setDefaultPresetName] = useState(
    _defaultPresetName as string
  )
  const [projectName, setProjectName] = useState('')
  const [projectVersion, setProjectVersion] = useState<number | undefined>(
    undefined
  )
  const [url, setUrl] = useState('')
  const [activeTab, setActiveTab] = useState<WebVMTab>('preview')
  const [activeFile, setActiveFile] = useState<WebPreviewProjectFile | null>(
    null
  )

  const { defaultProjectName } = useWebPreviewDefaultProjectName({
    sessionId: sessionIdFromProps
  })
  const { context } = useChatContext()
  const finalProjectName = projectName || defaultProjectName || ''
  const finalSessionId = sessionIdFromProps ?? context.id

  const webPreviewProjectReturns = useWebPreviewProject({
    projectName: finalProjectName,
    sessionId: finalSessionId,
    projectVersion,
    defaultPresetName
  })

  const enableSwitchDefaultPreset =
    getAllWebPreviewProjects(
      webPreviewProjectReturns.context?.conversations || []
    ).length < 1

  const finalProjectVersion =
    projectVersion ?? webPreviewProjectReturns.currentVersion

  useEffect(() => {
    setUrl(webPreviewProjectReturns.vmStatus?.previewUrl || '')
  }, [webPreviewProjectReturns.vmStatus?.previewUrl])

  const setFiles: React.Dispatch<
    React.SetStateAction<WebPreviewProjectFile[]>
  > = files => {
    if (typeof files === 'function') {
      webPreviewProjectReturns.updateFiles(
        finalProjectName,
        finalProjectVersion,
        files(webPreviewProjectReturns.currentVersionFiles)
      )
    } else {
      webPreviewProjectReturns.updateFiles(
        finalProjectName,
        finalProjectVersion,
        files
      )
    }
  }

  const setActiveFilePath = (filePath: string) => {
    const file = webPreviewProjectReturns.currentVersionFiles.find(
      file => file.path === filePath
    )

    if (file) {
      setActiveTab('code')
      setActiveFile(file)
    }
  }

  return (
    <ChatWebPreviewContext.Provider
      value={{
        ...webPreviewProjectReturns,
        sessionId: finalSessionId,
        defaultPresetName,
        setDefaultPresetName,
        projectName: finalProjectName,
        setProjectName,
        projectVersion: finalProjectVersion,
        setProjectVersion,
        setActiveFilePath,
        enableSwitchDefaultPreset,
        // webvm
        url,
        setUrl,
        files: webPreviewProjectReturns.currentVersionFiles,
        setFiles,
        activeTab,
        setActiveTab,
        activeFile,
        setActiveFile
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
