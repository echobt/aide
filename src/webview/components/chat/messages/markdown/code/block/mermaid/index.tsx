import { useEffect, useState, type FC, type ReactNode } from 'react'
import { CopyIcon } from '@radix-ui/react-icons'
import { CollapsibleCode } from '@webview/components/collapsible-code'
import { Button } from '@webview/components/ui/button'
import mermaid from 'mermaid'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

export interface MermaidProps {
  content: string
  bodyRender?: (props: {
    content: string
    originalNode: ReactNode
  }) => ReactNode
  defaultExpanded?: boolean
  className?: string
  style?: React.CSSProperties
}

export const Mermaid: FC<MermaidProps> = ({
  content,
  style,
  className = '',
  bodyRender,
  defaultExpanded
}) => {
  const mermaidContent = useMermaidRenderer(content)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content)
    toast.success('Mermaid code copied to clipboard')
  }

  const defaultBody = (
    <pre className="mermaid flex items-center justify-center text-sm overflow-auto">
      {mermaidContent}
    </pre>
  )

  const body = bodyRender
    ? bodyRender({ content, originalNode: defaultBody })
    : defaultBody

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
    <CollapsibleCode
      title="mermaid"
      actions={actions}
      className={className}
      defaultExpanded={defaultExpanded}
    >
      <div className="overflow-auto w-full h-full" style={style}>
        {body}
      </div>
    </CollapsibleCode>
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
