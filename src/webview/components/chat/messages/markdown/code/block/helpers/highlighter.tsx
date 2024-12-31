import type { FC } from 'react'
import { useShikiHighlighter } from '@webview/hooks/use-shiki-highlighter'
import parse from 'html-react-parser'

import type { BaseCodeBlockProps } from './types'

export interface HighlighterProps
  extends Omit<BaseCodeBlockProps, 'defaultExpanded'> {
  language: string
}

export const Highlighter: FC<HighlighterProps> = ({
  style,
  className,
  language,
  content
}) => {
  const { highlightedCode } = useShikiHighlighter({
    code: content,
    language
  })

  return (
    <div style={style} className={className}>
      {parse(highlightedCode)}
    </div>
  )
}
