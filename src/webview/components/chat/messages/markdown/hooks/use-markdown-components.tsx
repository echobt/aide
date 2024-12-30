import { type CSSProperties } from 'react'
import { ImagePreview } from '@webview/components/image/image-preview'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@webview/components/ui/table'
import { cn } from '@webview/utils/common'
import { Table, Video } from 'lucide-react'
import type { Components } from 'react-markdown'
import { Link } from 'react-router'

import { CodeBlock } from '../code/block'
import { InlineCode } from '../code/inline'
import type { CustomComponentConfig, MarkdownRendererOptions } from '../types'

export const useMarkdownComponents = (
  options: MarkdownRendererOptions,
  customComponentConfig: CustomComponentConfig = {}
): Components => {
  const { enableImageGallery, enableMermaid, variant } = options

  return {
    a: (props: any) => <Link {...props} {...customComponentConfig.a} />,
    img: enableImageGallery
      ? (props: any) =>
          (
            <ImagePreview
              {...props}
              {...customComponentConfig.img}
              style={getImageStyle(
                variant || 'normal',
                customComponentConfig.img?.style
              )}
            />
          ) as React.ReactNode
      : undefined,
    pre: (props: any) => (
      <CodeBlock
        enableMermaid={enableMermaid}
        highlight={customComponentConfig.highlight}
        mermaid={customComponentConfig.mermaid}
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
  }
}

const getImageStyle = (variant: string, customStyle?: CSSProperties) => {
  if (variant !== 'chat') return customStyle

  return {
    height: 'auto',
    maxWidth: 640,
    ...customStyle
  }
}
