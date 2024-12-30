import type { ImagePreviewProps } from '@webview/components/image/image-preview'
import type { VideoProps } from '@webview/components/video'

import type { CodeBlockProps } from './code/block'
import type { HighlighterProps } from './code/block/highlighter'
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
  highlight?: Partial<HighlighterProps>
  img?: Partial<ImagePreviewProps>
  mermaid?: Partial<MermaidProps>
  pre?: Partial<CodeBlockProps>
  video?: Partial<VideoProps>
  code?: Partial<InlineCodeProps>
}
