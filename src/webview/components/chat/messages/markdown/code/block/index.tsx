import { type FC, type ReactNode } from 'react'
import { cn } from '@webview/utils/common'

import { FileBlock } from './file-block'
import type { BaseCodeBlockProps } from './helpers/types'
import { useChildrenInfo } from './helpers/use-children-info'
import { MermaidBlock } from './mermaid-block'

export interface CodeBlockProps
  extends Omit<BaseCodeBlockProps, 'content'>,
    Omit<React.ComponentProps<'pre'>, 'content'> {
  children?: ReactNode
}

export const CodeBlock: FC<CodeBlockProps> = ({
  children,
  className,
  defaultExpanded = true,
  ...rest
}) => {
  const { content, shikiLang, markdownLang, fileInfo, fileContent } =
    useChildrenInfo(children)

  if (!content) return null

  const baseCodeBlockProps: BaseCodeBlockProps = {
    content,
    className: cn('overflow-hidden my-2', className),
    defaultExpanded,
    ...rest
  }

  // Render Mermaid if enabled and language is mermaid
  if (markdownLang === 'mermaid') {
    return <MermaidBlock {...baseCodeBlockProps} />
  }

  return (
    <FileBlock
      {...baseCodeBlockProps}
      language={shikiLang}
      fileContent={fileContent}
      fileInfo={fileInfo}
    />
  )
}
