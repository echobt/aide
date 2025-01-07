import { useMemo } from 'react'
import { useFileInfoForMessage } from '@webview/hooks/api/use-file-info-for-message'
import { getShikiLanguage } from '@webview/utils/shiki'

import { getContentInfoFromChildren, getRangeFromCode } from './utils'

export const FALLBACK_LANG = 'typescript'

export const useChildrenInfo = (children: any) => {
  const { content, markdownLang, relativePath } =
    getContentInfoFromChildren(children)

  const shikiLang = getShikiLanguage({
    unknownLang: markdownLang,
    path: relativePath
  })

  const { startLine, endLine } = useMemo(
    () => getRangeFromCode(content),
    [content]
  )
  const { data: fileInfo, isLoading } = useFileInfoForMessage({
    relativePath,
    startLine,
    endLine
  })

  const fileContent =
    startLine === undefined && content ? content : fileInfo?.content || ''

  return {
    content,
    fileContent,
    shikiLang,
    markdownLang,
    fileInfo,
    isLoading
  }
}
