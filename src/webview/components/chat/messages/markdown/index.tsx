import React, { type CSSProperties, type FC, type ReactNode } from 'react'
import { ImageGallery } from '@webview/components/image/image-gallery'
import { cn } from '@webview/utils/common'
import ReactMarkdown from 'react-markdown'

import { useMarkdownPlugins } from './hooks/use-markdown-plugins'
import {
  type CustomComponentConfig,
  type MarkdownRendererOptions
} from './types'
import { escapeBrackets, escapeMhchem, fixMarkdownBold } from './utils'

import './markdown.css'

import { ImagePreview } from '@webview/components/image/image-preview'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@webview/components/ui/table'
import { Video } from 'lucide-react'
import { Link } from 'react-router'

import { CodeBlock } from './code/block'
import { InlineCode } from './code/inline'

interface MarkdownProps extends MarkdownRendererOptions {
  children: string
  customComponentConfig?: CustomComponentConfig
  customRender?: (dom: ReactNode, context: { text: string }) => ReactNode
  className?: string
  style?: React.CSSProperties
}

export const Markdown: FC<MarkdownProps> = ({
  children,
  customComponentConfig = {},
  customRender,
  className,
  style,
  ...options
}) => {
  // Process content
  const content = options.enableLatex
    ? fixMarkdownBold(escapeMhchem(escapeBrackets(children)))
    : fixMarkdownBold(children)

  // Get plugins and components
  const { rehypePlugins, remarkPlugins } = useMarkdownPlugins(options)

  // Render markdown content
  const defaultDOM = (
    <ImageGallery enable={options.enableImageGallery}>
      <ReactMarkdown
        components={{
          a: (props: any) => <Link {...props} {...customComponentConfig.a} />,
          img: options.enableImageGallery
            ? (props: any) =>
                (
                  <ImagePreview
                    {...props}
                    {...customComponentConfig.img}
                    style={getImageStyle(
                      options.variant || 'normal',
                      customComponentConfig.img?.style
                    )}
                  />
                ) as React.ReactNode
            : undefined,
          pre: (props: any) => (
            <CodeBlock
              enableMermaid={options.enableMermaid}
              highlightProps={customComponentConfig.highlight}
              mermaidProps={customComponentConfig.mermaid}
              {...props}
              {...customComponentConfig.pre}
            />
          ),
          code: (props: any) => (
            <InlineCode {...props} {...customComponentConfig.code} />
          ),
          video: (props: any) => (
            <Video {...props} {...customComponentConfig.video} />
          ),
          table: (props: any) => <Table {...props} />,
          thead: (props: any) => <TableHeader {...props} />,
          tbody: (props: any) => <TableBody {...props} />,
          tr: (props: any) => <TableRow {...props} />,
          th: (props: any) => (
            <TableHead {...props} className={cn('border', props.className)} />
          ),
          td: (props: any) => (
            <TableCell {...props} className={cn('border', props.className)} />
          )
        }}
        rehypePlugins={rehypePlugins}
        remarkPlugins={remarkPlugins}
        {...options}
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
      style={customStyle}
    >
      {markdownContent}
    </article>
  )
}

const getImageStyle = (variant: string, customStyle?: CSSProperties) => {
  if (variant !== 'chat') return customStyle

  return {
    height: 'auto',
    maxWidth: 640,
    ...customStyle
  }
}
