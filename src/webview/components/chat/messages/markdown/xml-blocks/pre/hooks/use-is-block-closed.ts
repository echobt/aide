import { useMarkdownContext } from '@webview/components/chat/messages/markdown/context/markdown-context'
import type { Element } from 'hast'

interface UseIsBlockClosedProps {
  node: Element | undefined
}

export const useIsBlockClosed = (props: UseIsBlockClosedProps) => {
  const { markdownContent, isContentGenerating } = useMarkdownContext()
  const { node } = props
  const end = node?.position?.end.offset || 0

  if (!end) return false

  // generate content is not complete and current block is not closed
  if (!isContentGenerating || markdownContent.length - end > 10) return true

  return false
}
