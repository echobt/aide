import { type FC, type ReactNode } from 'react'
import { cn } from '@webview/utils/common'

import { FileBlock } from './file-block'
import type { BaseCodeBlockProps } from './helpers/types'
import { getContentInfoFromChildren } from './helpers/utils'
import { MermaidBlock } from './mermaid-block'

export interface CodeBlockProps
  extends Omit<BaseCodeBlockProps, 'content'>,
    Omit<React.ComponentProps<'pre'>, 'content'> {
  children?: ReactNode
  enableActionController?: boolean
}

export const CodeBlock: FC<CodeBlockProps> = ({
  children,
  className,
  defaultExpanded = true,
  enableActionController = false,
  ...rest
}) => {
  const { content, markdownLang } = getContentInfoFromChildren(children)

  if (!content) return null

  const baseCodeBlockProps: BaseCodeBlockProps = {
    className: cn('overflow-hidden my-2', className),
    defaultExpanded,
    ...rest
  }

  // Render Mermaid if enabled and language is mermaid
  if (markdownLang === 'mermaid') {
    return <MermaidBlock {...baseCodeBlockProps} content={content} />
  }

  return (
    <FileBlock
      {...baseCodeBlockProps}
      originalContent={content}
      enableActionController={enableActionController}
    >
      {children}
    </FileBlock>
  )
}
