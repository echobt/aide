import {
  useMemo,
  type ComponentProps,
  type CSSProperties,
  type FC
} from 'react'
import { ImageGallery } from '@webview/components/image/image-gallery'
import { Link } from '@webview/components/link'
import { Video, type VideoProps } from '@webview/components/video'
import { cn } from '@webview/utils/common'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { PluggableList } from 'unified'

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

import { CodeBlock } from './code/block'
import { InlineCode } from './code/inline'

export type MarkdownVariant = 'normal' | 'chat'

export interface MarkdownProps {
  children: string
  className?: string
  style?: CSSProperties

  fontSize?: number
  headerMultiple?: number
  lineHeight?: number
  marginMultiple?: number
  allowHtml?: boolean
  enableLatex?: boolean
  variant?: MarkdownVariant

  enableActionController?: boolean
}

export const Markdown: FC<MarkdownProps> = ({
  children,
  className,
  style,

  fontSize,
  headerMultiple,
  lineHeight,
  marginMultiple,
  allowHtml,
  enableLatex,
  variant = 'normal',

  enableActionController = false
}) => {
  const content = enableLatex
    ? fixMarkdownBold(escapeMhchem(escapeBrackets(children)))
    : fixMarkdownBold(children)

  const { rehypePlugins, remarkPlugins } = useMarkdownPlugins({
    allowHtml,
    enableLatex,
    variant
  })

  const customStyle = {
    ...style,
    ...(fontSize && {
      '--aide-markdown-font-size': `${fontSize}px`
    }),
    ...(headerMultiple && {
      '--aide-markdown-header-multiple': headerMultiple
    }),
    ...(lineHeight && {
      '--aide-markdown-line-height': lineHeight
    }),
    ...(marginMultiple && {
      '--aide-markdown-margin-multiple': marginMultiple
    })
  } as CSSProperties

  return (
    <article
      className={cn('message-markdown', className)}
      data-code-type="markdown"
      style={customStyle}
    >
      <ImageGallery>
        <ReactMarkdown
          components={{
            a: (props: ComponentProps<'a'>) => <Link {...props} />,
            img: (props: ComponentProps<'img'>) => (
              <ImagePreview
                {...props}
                style={getImageStyle(variant, props.style)}
              />
            ),
            pre: (props: ComponentProps<'pre'>) => (
              <CodeBlock
                {...props}
                enableActionController={enableActionController}
              />
            ),
            code: (props: ComponentProps<'code'>) => <InlineCode {...props} />,
            video: (props: ComponentProps<'video'>) => (
              <Video {...(props as VideoProps)} />
            ),
            table: (props: ComponentProps<'table'>) => <Table {...props} />,
            thead: (props: ComponentProps<'thead'>) => (
              <TableHeader {...props} />
            ),
            tbody: (props: ComponentProps<'tbody'>) => <TableBody {...props} />,
            tr: (props: ComponentProps<'tr'>) => <TableRow {...props} />,
            th: (props: ComponentProps<'th'>) => (
              <TableHead {...props} className={cn('border', props.className)} />
            ),
            td: (props: ComponentProps<'td'>) => (
              <TableCell {...props} className={cn('border', props.className)} />
            )
          }}
          rehypePlugins={rehypePlugins}
          remarkPlugins={remarkPlugins}
        >
          {content}
        </ReactMarkdown>
      </ImageGallery>
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

export const useMarkdownPlugins = (
  options: Pick<MarkdownProps, 'allowHtml' | 'enableLatex' | 'variant'>
) => {
  const { allowHtml, enableLatex, variant } = options

  const rehypePlugins = useMemo(() => {
    const plugins: PluggableList = []
    if (allowHtml) plugins.push(rehypeRaw)
    if (enableLatex) plugins.push([rehypeKatex, { output: 'mathml' }])
    return plugins
  }, [allowHtml, enableLatex])

  const remarkPlugins = useMemo(() => {
    const plugins: PluggableList = [remarkGfm]
    if (enableLatex) plugins.push(remarkMath)
    if (variant === 'chat') plugins.push(remarkBreaks)
    return plugins
  }, [enableLatex, variant])

  return { rehypePlugins, remarkPlugins }
}
