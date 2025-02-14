import { useMemo, type FC } from 'react'
import { CodeBlockParser } from '@shared/plugins/markdown/parsers/code-block-parser'
import { FALLBACK_LANG } from '@shared/plugins/markdown/utils/code-block-utils'
import { useFileInfoForMessage } from '@webview/hooks/api/use-file-info-for-message'
import { cn } from '@webview/utils/common'
import { getShikiLanguage } from '@webview/utils/shiki'

import { useBlockOriginalContent } from '../../hooks/use-block-original-content'
import type { MDElementProps } from '../types'
import { CodeBlock } from './code-block'
import { CodeBlockContextProvider } from './context/code-block-context'
import { useIsBlockClosed } from './hooks/use-is-block-closed'

export const Pre: FC<MDElementProps<'pre'>> = ({
  // eslint-disable-next-line unused-imports/no-unused-vars
  children,
  node,
  ...elProps
}) => {
  const originalContent = useBlockOriginalContent(node)
  const isBlockClosed = useIsBlockClosed({ node })

  const codeBlockInfo = useMemo(() => {
    const codeBlockParser = new CodeBlockParser()
    return codeBlockParser.parseMarkdownContent(originalContent)[0]
  }, [originalContent])

  const {
    filePath,
    v1ProjectFilePath,
    startLine,
    endLine,
    mdLang = FALLBACK_LANG
  } = codeBlockInfo?.otherInfo || {}
  const content = codeBlockInfo?.content || ''

  const shikiLang = getShikiLanguage({
    unknownLang: mdLang,
    path: filePath || v1ProjectFilePath
  })

  const { data: fileInfo, isLoading } = useFileInfoForMessage({
    schemeUri: filePath
  })

  const getWebPreviewProjectFileFullContent = () => ''

  const processedContent = useMemo(() => {
    const v1ProjectFileFullContent = getWebPreviewProjectFileFullContent()

    if (startLine !== undefined && endLine !== undefined) {
      const fileFullContent =
        (v1ProjectFilePath ? v1ProjectFileFullContent : fileInfo?.content) || ''

      if (fileFullContent)
        return fileFullContent
          .split('\n')
          .slice(startLine, endLine + 1)
          .join('\n')
    }
    if (content) return content
    if (filePath && fileInfo?.content) return fileInfo.content
    if (v1ProjectFilePath && v1ProjectFileFullContent)
      return v1ProjectFileFullContent

    return ''
  }, [
    getWebPreviewProjectFileFullContent,
    content,
    v1ProjectFilePath,
    fileInfo?.content,
    filePath,
    startLine,
    endLine
  ])

  if (!originalContent) return null

  return (
    <CodeBlockContextProvider
      value={{
        content,
        processedContent,
        shikiLang,
        mdLang,
        fileInfo,
        isLoading,
        isBlockClosed,
        elProps: {
          ...elProps,
          className: cn('overflow-hidden my-2', elProps.className)
        }
      }}
    >
      <CodeBlock />
    </CodeBlockContextProvider>
  )
}
