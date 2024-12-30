import type { CSSProperties, FC } from 'react'
import { useShikiHighlighter } from '@webview/hooks/use-shiki-highlighter'
import parse from 'html-react-parser'

export interface HighlighterProps {
  style?: CSSProperties
  className?: string
  language: string
  content: string
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
