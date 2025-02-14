import React, { createContext, FC, useContext } from 'react'

export type MarkdownVariant = 'normal' | 'chat'

type MarkdownContextValue = {
  markdownContent: string
  codeBlockDefaultExpanded: boolean
  variant: MarkdownVariant
  isContentGenerating: boolean
}

const MarkdownContext = createContext<MarkdownContextValue | null>(null)

export const useMarkdownContext = () => {
  const context = useContext(MarkdownContext)
  if (!context) {
    throw new Error(
      'useMarkdownContext must be used within a MarkdownContextProvider'
    )
  }
  return context
}

export const MarkdownContextProvider: FC<{
  value: MarkdownContextValue
  children: React.ReactNode
}> = ({ value, children }) => (
  <MarkdownContext.Provider value={value}>{children}</MarkdownContext.Provider>
)
