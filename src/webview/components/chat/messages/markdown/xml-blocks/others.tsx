/* eslint-disable unused-imports/no-unused-vars */
import { FC, type CSSProperties } from 'react'
import { ImagePreview } from '@webview/components/image/image-preview'
import { Link } from '@webview/components/link'
import { TableCell, TableHead } from '@webview/components/ui/table'
import { cn } from '@webview/utils/common'

import { useMarkdownContext } from '../context/markdown-context'
import type { MDElementProps } from './types'

export const A: FC<MDElementProps<'a'>> = ({ children, node, ...elProps }) => (
  <Link {...elProps}>{children}</Link>
)

export const Img: FC<MDElementProps<'img'>> = ({ node, ...elProps }) => {
  const { variant } = useMarkdownContext()

  const getImageStyle = (variant: string, customStyle?: CSSProperties) => {
    if (variant !== 'chat') return customStyle

    return {
      height: 'auto',
      maxWidth: 640,
      ...customStyle
    }
  }

  return (
    <ImagePreview {...elProps} style={getImageStyle(variant, elProps.style)} />
  )
}

export const Th: FC<MDElementProps<'th'>> = ({ node, ...elProps }) => (
  <TableHead {...elProps} className={cn('border', elProps.className)} />
)

export const Td: FC<MDElementProps<'td'>> = ({ node, ...elProps }) => (
  <TableCell {...elProps} className={cn('border', elProps.className)} />
)

export const P: FC<MDElementProps<'p'>> = ({ node, ...elProps }) => (
  <div {...elProps} className={cn('markdown-p', elProps.className)} />
)
