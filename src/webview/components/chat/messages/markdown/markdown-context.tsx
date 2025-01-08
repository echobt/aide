import React, { createContext, FC, useContext } from 'react'

type MarkdownContextValue = {
  markdownContent: string
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
  markdownContent: string
  children: React.ReactNode
}> = ({ markdownContent, children }) => (
  <MarkdownContext.Provider value={{ markdownContent }}>
    {children}
  </MarkdownContext.Provider>
)
