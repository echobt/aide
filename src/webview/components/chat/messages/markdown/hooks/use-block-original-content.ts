import { useMemo } from 'react'
import type { Element } from 'hast'
import { decode } from 'js-base64'

import { useMarkdownContext } from '../context/markdown-context'
import type { BaseCustomElementProperties } from '../xml-blocks/types'

// if encodedContent is provided, it will return the custom element's children raw content
export const useBlockOriginalContent = (
  node:
    | Element
    | undefined
    | (Omit<Element, 'properties'> & {
        properties: BaseCustomElementProperties
      })
) => {
  const { markdownContent } = useMarkdownContext()

  return useMemo(() => {
    const encodedContent = String(node?.properties.encodedcontent || '')
    if (encodedContent) {
      return decode(encodedContent)
    }

    const position = node?.position
    const originalContent = position
      ? markdownContent.slice(position.start.offset, position.end.offset)
      : ''

    return originalContent
  }, [markdownContent, node?.position])
}
