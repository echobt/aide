/* eslint-disable unused-imports/no-unused-vars */
import { useRef } from 'react'
import { CopyIcon } from '@radix-ui/react-icons'
import { useMarkdownContext } from '@webview/components/chat/messages/markdown/context/markdown-context'
import { useCodeBlockContext } from '@webview/components/chat/messages/markdown/xml-blocks/pre/context/code-block-context'
import { Button } from '@webview/components/ui/button'
import { CollapsibleBlock } from '@webview/components/ui/collapsible-block'
import { copyToClipboard } from '@webview/utils/api'
import { toast } from 'sonner'

import { useMermaid } from './use-mermaid'

export const MermaidBlock = () => {
  const { codeBlockDefaultExpanded } = useMarkdownContext()
  const { content, elProps } = useCodeBlockContext()
  const containerRef = useRef<HTMLDivElement>(null!)
  const svg = useMermaid(content, containerRef)

  const copy = async () => {
    await copyToClipboard(content)
    toast.success('Mermaid code copied to clipboard')
  }

  const actions = (
    <Button
      className="transition-colors"
      onClick={copy}
      size="iconXss"
      variant="ghost"
      aria-label="Copy mermaid code"
    >
      <CopyIcon className="size-3" />
    </Button>
  )

  return (
    <CollapsibleBlock
      title="mermaid"
      actionSlot={actions}
      defaultExpanded={codeBlockDefaultExpanded}
      {...elProps}
    >
      <div
        ref={containerRef}
        className="overflow-auto w-full h-full"
        style={elProps.style}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </CollapsibleBlock>
  )
}
