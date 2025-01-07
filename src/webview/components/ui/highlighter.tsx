import type { FC } from 'react'
import { useShikiHighlighter } from '@webview/hooks/use-shiki-highlighter'
import parse from 'html-react-parser'

export interface HighlighterProps {
  language: string
  content: string
  style?: React.CSSProperties
  className?: string
}

export const Highlighter: FC<HighlighterProps> = ({
  style,
  language,
  content,
  className
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
