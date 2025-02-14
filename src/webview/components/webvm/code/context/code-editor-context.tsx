import { createContext, useContext, useState, type ReactNode } from 'react'
import { api } from '@webview/network/actions-api'

import { useCodeExplorerContext } from './code-explorer-context'

interface CodeEditorContextValue {
  showDiff: boolean
  toggleDiff: () => void
  hasDiff: boolean
  originalFileContent: string
  handleCopyFileContent: () => void
  handleContentChange: (value: string | undefined) => void
}

const CodeEditorContext = createContext<CodeEditorContextValue | null>(null)

interface CodeEditorProviderProps {
  children: ReactNode
  value: {}
}

export const CodeEditorProvider = ({
  children,
  value
}: CodeEditorProviderProps) => {
  const { activeFile, preVersionFiles, setFiles, readonly } =
    useCodeExplorerContext()
  const [showDiff, setShowDiff] = useState(false)

  const handleCopyFileContent = async () => {
    if (activeFile) {
      await api.actions().server.webvm.copyToClipboard({
        actionParams: { text: activeFile.content }
      })
    }
  }

  const toggleDiff = () => setShowDiff(prev => !prev)

  const originalFile = activeFile
    ? preVersionFiles?.find(f => f.path === activeFile.path)
    : null

  const originalFileContent = originalFile?.content || ''

  const hasDiff = Boolean(
    originalFile && activeFile && originalFile.content !== activeFile.content
  )

  const handleContentChange = (value: string | undefined) => {
    if (readonly || !activeFile || !value) return

    setFiles(prev =>
      prev?.map(file =>
        file.path === activeFile.path ? { ...file, content: value } : file
      )
    )
  }

  return (
    <CodeEditorContext.Provider
      value={{
        ...value,
        showDiff,
        toggleDiff,
        hasDiff,
        originalFileContent,
        handleCopyFileContent,
        handleContentChange
      }}
    >
      {children}
    </CodeEditorContext.Provider>
  )
}

export const useCodeEditorContext = () => {
  const context = useContext(CodeEditorContext)
  if (!context) {
    throw new Error(
      'useCodeEditorContext must be used within a CodeEditorProvider'
    )
  }
  return context
}
