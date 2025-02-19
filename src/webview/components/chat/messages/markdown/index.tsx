/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  useMemo,
  type ComponentProps,
  type CSSProperties,
  type FC
} from 'react'
import { ImageGallery } from '@webview/components/image/image-gallery'
import { Video } from '@webview/components/video'
import { cn } from '@webview/utils/common'
import ReactMarkdown from 'react-markdown'

import './markdown.css'

import { ChatContextType } from '@shared/entities'
import { extractCustomBlocks } from '@shared/plugins/markdown/utils/extract-custom-blocks'
import { fixMarkdownContent } from '@shared/plugins/markdown/utils/fix-markdown-content'
import {
  Table,
  TableBody,
  TableHeader,
  TableRow
} from '@webview/components/ui/table'
import { useChatContext } from '@webview/contexts/chat-context'

import {
  MarkdownContextProvider,
  type MarkdownVariant
} from './context/markdown-context'
import { useMarkdownPlugins } from './hooks/use-markdown-plugins'
import { Code } from './xml-blocks/code'
import {
  customComponents,
  customComponentTagNames
} from './xml-blocks/custom-element-block'
import { A, Img, P, Td, Th } from './xml-blocks/others'
import { Pre } from './xml-blocks/pre'

export interface MarkdownProps {
  children: string
  className?: string
  style?: CSSProperties

  fontSize?: number
  headerMultiple?: number
  lineHeight?: number
  marginMultiple?: number
  variant?: MarkdownVariant

  isContentGenerating?: boolean
}

export const Markdown: FC<MarkdownProps> = ({
  children,
  className,
  style,

  fontSize,
  headerMultiple,
  lineHeight,
  marginMultiple,
  variant = 'normal',

  isContentGenerating = false
}) => {
  const { processedMarkdown } = useMemo(
    () =>
      extractCustomBlocks(
        fixMarkdownContent(children),
        customComponentTagNames
      ),
    [children]
  )
  const { context } = useChatContext()
  const codeBlockDefaultExpanded = [ChatContextType.Chat].includes(context.type)

  const { rehypePlugins, remarkPlugins } = useMarkdownPlugins({
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
    <MarkdownContextProvider
      value={{
        markdownContent: processedMarkdown,
        codeBlockDefaultExpanded,
        variant,
        isContentGenerating
      }}
    >
      <article
        className={cn('message-markdown', className)}
        data-code-type="markdown"
        style={customStyle}
      >
        <ImageGallery>
          <ReactMarkdown
            components={{
              a: A,
              img: Img,
              pre: Pre,
              code: Code,
              video: Video as FC<ComponentProps<'video'>>,
              table: Table,
              thead: TableHeader,
              tbody: TableBody,
              tr: TableRow,
              th: Th,
              td: Td,
              p: P,

              ...customComponents
            }}
            rehypePlugins={rehypePlugins}
            remarkPlugins={remarkPlugins}
            remarkRehypeOptions={{
              allowDangerousHtml: true
            }}
          >
            {processedMarkdown}
          </ReactMarkdown>
        </ImageGallery>
      </article>
    </MarkdownContextProvider>
  )
}
