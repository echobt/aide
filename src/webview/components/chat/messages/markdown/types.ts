import type { ImagePreviewProps } from '@webview/components/image/image-preview'
import type { VideoProps } from '@webview/components/video'

import type { CodeBlockProps, HighlighterBlockProps } from './code/block'
import type { MermaidProps } from './code/block/mermaid'
import type { InlineCodeProps } from './code/inline'

export interface MarkdownRendererOptions {
  fontSize?: number
  headerMultiple?: number
  lineHeight?: number
  marginMultiple?: number
  allowHtml?: boolean
  enableLatex?: boolean
  enableMermaid?: boolean
  enableImageGallery?: boolean
  variant?: 'normal' | 'chat'
}

export interface CustomComponentConfig {
  a?: Partial<React.AnchorHTMLAttributes<HTMLAnchorElement>>
  highlight?: Partial<HighlighterBlockProps>
  img?: Partial<ImagePreviewProps>
  mermaid?: Partial<MermaidProps>
  pre?: Partial<CodeBlockProps>
  video?: Partial<VideoProps>
  code?: Partial<InlineCodeProps>
}
