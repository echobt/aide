import path from 'path'
import { vfs } from '@extension/file-utils/vfs'
import { getLanguageId } from '@shared/utils/vscode-lang'
import { t } from 'i18next'

export interface CodeSnippetInfo {
  schemeUri?: string
  language?: string
  code: string
  showLine: boolean
  startLine?: number
  endLine?: number
}

export const formatCodeSnippet = (
  snippet: CodeSnippetInfo,
  isEspeciallyRelevant?: boolean
): string => {
  const filePathOrSchemeUri = vfs.resolvePathForAIPrompt(
    snippet.schemeUri || ''
  )
  const languageId = filePathOrSchemeUri
    ? getLanguageId(path.extname(filePathOrSchemeUri).slice(1))
    : snippet.language || ''

  const codeLines = snippet.showLine ? snippet.code.split('\n') : null
  const startLine = Math.max(1, snippet.startLine || 1)
  const endLine =
    snippet.endLine ||
    (codeLines ? startLine + codeLines.length - 1 : startLine)

  if (startLine > endLine) {
    throw new Error(t('extension.chat.codeSnippet.startLineGreaterThanEndLine'))
  }

  let formattedCode: string

  if (snippet.showLine && codeLines) {
    let result = ''
    for (let i = 0; i < codeLines.length; i++) {
      result += `${startLine + i}|${codeLines[i]}\n`
    }
    formattedCode = result.trimEnd()
  } else {
    formattedCode = snippet.code
  }

  const codeBlock = filePathOrSchemeUri
    ? `\`\`\`${languageId}:${filePathOrSchemeUri}\n${formattedCode}\n\`\`\``
    : `\`\`\`${languageId}\n${formattedCode}\n\`\`\``

  return isEspeciallyRelevant
    ? `<especially_relevant_code_snippet>\n${codeBlock}\n</especially_relevant_code_snippet>\n`
    : `${codeBlock}\n\n`
}
