import React, { type FC, type ReactNode } from 'react'
import { ImageGallery } from '@webview/components/image/image-gallery'
import { cn } from '@webview/utils/common'
import ReactMarkdown from 'react-markdown'

import { useMarkdownComponents } from './hooks/use-markdown-components'
import { useMarkdownPlugins } from './hooks/use-markdown-plugins'
import {
  type CustomComponentConfig,
  type MarkdownRendererOptions
} from './types'
import { escapeBrackets, escapeMhchem, fixMarkdownBold } from './utils'

import './markdown.css'

interface MarkdownProps extends React.HTMLAttributes<HTMLDivElement> {
  children: string
  options?: MarkdownRendererOptions
  customComponentConfig?: CustomComponentConfig
  customRender?: (dom: ReactNode, context: { text: string }) => ReactNode
}

export const Markdown: FC<MarkdownProps> = ({
  children,
  className,
  style,
  options = {},
  customComponentConfig = {},
  customRender,
  onDoubleClick,
  ...rest
}) => {
  // Process content
  const content = options.enableLatex
    ? fixMarkdownBold(escapeMhchem(escapeBrackets(children)))
    : fixMarkdownBold(children)

  // Get plugins and components
  const { rehypePlugins, remarkPlugins } = useMarkdownPlugins(options)
  const components = useMarkdownComponents(options, customComponentConfig)

  // Render markdown content
  const defaultDOM = (
    <ImageGallery enable={options.enableImageGallery}>
      <ReactMarkdown
        components={components}
        rehypePlugins={rehypePlugins}
        remarkPlugins={remarkPlugins}
        {...rest}
      >
        {content}
      </ReactMarkdown>
    </ImageGallery>
  )

  const markdownContent = customRender
    ? customRender(defaultDOM, { text: content })
    : defaultDOM

  // Custom styles
  const customStyle = {
    ...style,
    ...(options.fontSize && {
      '--aide-markdown-font-size': `${options.fontSize}px`
    }),
    ...(options.headerMultiple && {
      '--aide-markdown-header-multiple': options.headerMultiple
    }),
    ...(options.lineHeight && {
      '--aide-markdown-line-height': options.lineHeight
    }),
    ...(options.marginMultiple && {
      '--aide-markdown-margin-multiple': options.marginMultiple
    })
  } as React.CSSProperties

  return (
    <article
      className={cn('message-markdown', className)}
      data-code-type="markdown"
      onDoubleClick={onDoubleClick}
      style={customStyle}
    >
      {markdownContent}
    </article>
  )
}
