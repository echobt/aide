import React, {
  createContext,
  FC,
  useContext,
  type ComponentProps
} from 'react'
import type { FileInfo } from '@webview/types/chat'

type CodeBlockContextValue = {
  content: string
  processedContent: string
  fileInfo: FileInfo | null | undefined
  shikiLang: string
  mdLang: string
  isLoading: boolean
  elProps: Omit<ComponentProps<'pre'>, 'children'>
  isBlockClosed: boolean
}

const CodeBlockContext = createContext<CodeBlockContextValue | null>(null)

export const useCodeBlockContext = () => {
  const context = useContext(CodeBlockContext)
  if (!context) {
    throw new Error(
      'useCodeBlockContext must be used within a CodeBlockContextProvider'
    )
  }
  return context
}

interface CodeBlockContextProviderProps {
  value: CodeBlockContextValue
  children: React.ReactNode
}

export const CodeBlockContextProvider: FC<CodeBlockContextProviderProps> = ({
  value,
  children
}) => (
  <CodeBlockContext.Provider value={value}>
    {children}
  </CodeBlockContext.Provider>
)
