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
}

export const useMarkdownPlugins = (options: UseMarkdownPluginsOptions) => {
  const { variant } = options

  const rehypePlugins = useMemo(() => {
    const plugins: PluggableList = [
      rehypeRaw,
      [rehypeKatex, { output: 'mathml' }]
    ]
    return plugins
  }, [])

  const remarkPlugins = useMemo(() => {
    const plugins: PluggableList = [remarkGfm, remarkMath]
    if (variant === 'chat') plugins.push(remarkBreaks)
    return plugins
  }, [variant])

  return { rehypePlugins, remarkPlugins }
}
