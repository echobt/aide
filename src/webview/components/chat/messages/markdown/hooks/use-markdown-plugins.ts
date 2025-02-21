import { useMemo } from 'react'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { PluggableList } from 'unified'

import type { MarkdownVariant } from '../context/markdown-context'

interface UseMarkdownPluginsOptions {
  variant: MarkdownVariant
  isContentGenerating: boolean
}

export const useMarkdownPlugins = (options: UseMarkdownPluginsOptions) => {
  const { variant, isContentGenerating } = options

  const rehypePlugins = useMemo(() => {
    const plugins: PluggableList = [
      rehypeRaw,
      [rehypeKatex, { output: 'mathml' }]
    ]

    if (!isContentGenerating) {
      plugins.push([rehypeKatex, { output: 'mathml' }])
    }

    return plugins
  }, [isContentGenerating])

  const remarkPlugins = useMemo(() => {
    const plugins: PluggableList = [remarkGfm]

    if (variant === 'chat') plugins.push(remarkBreaks)
    if (!isContentGenerating) plugins.push(remarkMath)

    return plugins
  }, [variant])

  return { rehypePlugins, remarkPlugins }
}
