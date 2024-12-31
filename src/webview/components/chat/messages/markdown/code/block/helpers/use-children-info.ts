import { useFileInfoForMessage } from '@webview/hooks/api/use-file-info-for-message'
import { getShikiLanguage } from '@webview/utils/shiki'

import { getContentInfoFromChildren, getRangeFromCode } from './utils'

export const FALLBACK_LANG = 'typescript'

export const useChildrenInfo = (children: any) => {
  const contentInfo = getContentInfoFromChildren(children)
  const { content, className } = contentInfo
  const markdownLangLineStr =
    className?.replace('language-', '') || FALLBACK_LANG
  const [markdownLang, relativePath] = markdownLangLineStr.split(':')

  const shikiLang = getShikiLanguage({
    unknownLang: markdownLang,
    path: relativePath
  })

  const { startLine, endLine } = getRangeFromCode(content)
  const { data: fileInfo } = useFileInfoForMessage({
    relativePath,
    startLine,
    endLine
  })

  const fileContent =
    startLine === undefined && content ? content : fileInfo?.content || ''

  return { content, fileContent, shikiLang, markdownLang, fileInfo }
}
