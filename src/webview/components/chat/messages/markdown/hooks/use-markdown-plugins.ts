import { useMemo } from 'react'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { PluggableList } from 'unified'

import type { MarkdownRendererOptions } from '../types'

// Hook to manage markdown plugins configuration
export const useMarkdownPlugins = (options: MarkdownRendererOptions) => {
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
