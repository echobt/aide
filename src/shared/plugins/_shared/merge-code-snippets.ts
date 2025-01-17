import { vfs } from '@extension/file-utils/vfs'
import type { CodeSnippet } from '@shared/plugins/agents/codebase-search-agent-plugin/types'
import { settledPromiseResults } from '@shared/utils/common'

export type MergeCodeSnippetsMode = 'default' | 'expanded'

export const mergeCodeSnippets = async (
  snippets: CodeSnippet[],
  options?: {
    mode?: MergeCodeSnippetsMode
    minLines?: number
  }
): Promise<CodeSnippet[]> => {
  const { mode = 'default', minLines = 500 } = options || {}
  const mergedSnippets = mergeSnippetRanges(snippets)
  const processedSnippets = await processSnippets(
    mergedSnippets,
    mode,
    minLines
  )
  return sortSnippets(processedSnippets)
}

const mergeSnippetRanges = (
  snippets: CodeSnippet[]
): { [key: string]: CodeSnippet } => {
  const mergedSnippets: { [key: string]: CodeSnippet } = {}

  snippets.forEach(snippet => {
    const key = snippet.schemeUri

    if (!mergedSnippets[key]) {
      mergedSnippets[key] = { ...snippet }
    } else {
      mergedSnippets[key]!.startLine = Math.min(
        mergedSnippets[key]!.startLine,
        snippet.startLine
      )
      mergedSnippets[key]!.endLine = Math.max(
        mergedSnippets[key]!.endLine,
        snippet.endLine
      )
      mergedSnippets[key]!.code = ''
    }
  })

  return mergedSnippets
}

const processSnippets = async (
  mergedSnippets: { [key: string]: CodeSnippet },
  mode: MergeCodeSnippetsMode,
  minLines: number
): Promise<CodeSnippet[]> => {
  await settledPromiseResults(
    Object.values(mergedSnippets).map(async snippet => {
      const fullCode = await vfs.promises.readFile(snippet.schemeUri, 'utf-8')
      const lines = fullCode.split('\n')

      let { startLine, endLine } = snippet
      const totalLines = lines.length

      if (mode === 'default') {
        snippet.code = lines.slice(startLine, endLine + 1).join('\n')
      } else if (mode === 'expanded') {
        if (endLine - startLine > minLines) {
          // If the merged snippet is already larger than minLines, return as is
          snippet.code = lines.slice(startLine, endLine + 1).join('\n')
        } else if (totalLines <= minLines) {
          // If the entire file is smaller than minLines, return the whole file
          startLine = 0
          endLine = totalLines
          snippet.code = fullCode
        } else {
          // Expand the snippet to reach minLines
          const expansion = Math.ceil((minLines - (endLine - startLine)) / 2)
          startLine = Math.max(0, startLine - expansion)
          endLine = Math.min(totalLines, endLine + expansion)
          snippet.code = lines.slice(startLine, endLine + 1).join('\n')
        }
      }

      mergedSnippets[snippet.schemeUri] = {
        ...snippet,
        startLine,
        endLine
      }
    })
  )

  return Object.values(mergedSnippets)
}

const sortSnippets = (snippets: CodeSnippet[]): CodeSnippet[] =>
  snippets.sort((a, b) => a.schemeUri.localeCompare(b.schemeUri))
