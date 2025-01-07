/* eslint-disable unused-imports/no-unused-vars */
import { useEffect, useState, type FC } from 'react'
import { CopyIcon } from '@radix-ui/react-icons'
import { Button } from '@webview/components/ui/button'
import { CollapsibleBlock } from '@webview/components/ui/collapsible-block'
import mermaid from 'mermaid'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

import type { BaseCodeBlockProps } from '../helpers/types'

export interface MermaidBlockProps extends BaseCodeBlockProps {
  content: string
}

export const MermaidBlock: FC<MermaidBlockProps> = ({
  content,
  style,
  className = '',
  defaultExpanded,
  ...rest
}) => {
  const mermaidContent = useMermaidRenderer(content)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content)
    toast.success('Mermaid code copied to clipboard')
  }

  const actions = (
    <Button
      className="transition-colors"
      onClick={copyToClipboard}
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
      className={className}
      defaultExpanded={defaultExpanded}
      {...rest}
    >
      <div className="overflow-auto w-full h-full" style={style}>
        <pre className="mermaid flex items-center justify-center text-sm overflow-auto">
          {mermaidContent}
        </pre>
      </div>
    </CollapsibleBlock>
  )
}

export const useMermaidRenderer = (content: string) => {
  const [mermaidContent, setMermaidContent] = useState<string>()
  const { theme } = useTheme()

  useEffect(() => {
    mermaid.initialize({
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      securityLevel: 'loose',
      startOnLoad: true,
      theme: theme === 'dark' ? 'dark' : 'default'
    })
    mermaid.contentLoaded()
  }, [mermaidContent, theme])

  const checkSyntax = async (textStr: string) => {
    try {
      if (await mermaid.parse(textStr)) {
        setMermaidContent(textStr)
      }
    } catch {}
  }

  useEffect(() => {
    checkSyntax(content)
  }, [content])

  return mermaidContent
}
