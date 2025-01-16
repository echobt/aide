import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { createShouldIgnore } from '@extension/file-utils/ignore-patterns'
import { vfs } from '@extension/file-utils/vfs'
import { workspaceSchemeHandler } from '@extension/file-utils/vfs/schemes/workspace-scheme'
import { getWorkspaceFolder } from '@extension/utils'
import { glob } from 'glob'
import { z } from 'zod'

import { grepSearchAgentName } from './agent-names'

export class GrepSearchAgent extends BaseAgent<BaseGraphState, {}> {
  static name = grepSearchAgentName

  name = GrepSearchAgent.name

  logTitle = 'Grep Search'

  description = `Fast text-based regex search that finds exact pattern matches within files or directories, utilizing the ripgrep command for efficient searching.
Results will be formatted in the style of ripgrep and can include line numbers and content.
To avoid overwhelming output, the results are capped at 50 matches.
Use the include or exclude patterns to filter the search scope by file type or specific paths.

This is best for finding exact text matches or regex patterns.
More precise than semantic search for finding specific strings or patterns.
This is preferred over semantic search when we know the exact symbol/function name/etc. to search in some set of directories/file types.`

  inputSchema = z.object({
    query: z.string().describe('The regex pattern to search for'),
    caseSensitive: z
      .boolean()
      .optional()
      .describe('Whether the search should be case sensitive'),
    includePattern: z
      .string()
      .optional()
      .describe(
        'Glob pattern for files to include (e.g. "*.ts" for TypeScript files)'
      ),
    excludePattern: z
      .string()
      .optional()
      .describe('Glob pattern for files to exclude'),
    explanation: z
      .string()
      .optional()
      .describe(
        'One sentence explanation as to why this tool is being used, and how it contributes to the goal.'
      )
  })

  outputSchema = z.object({
    matches: z.array(
      z.object({
        relativePath: z.string(),
        lineNumber: z.number(),
        content: z.string()
      })
    )
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    const workspaceFolder = getWorkspaceFolder()
    const workspacePath = workspaceFolder.uri.fsPath
    const workspaceSchemeUri = workspaceSchemeHandler.createSchemeUri({
      relativePath: './'
    })

    // Create ignore function based on workspace settings
    const shouldIgnore = await createShouldIgnore(workspaceSchemeUri)

    // Get all files based on include/exclude patterns
    const files = await glob(input.includePattern || '**/*', {
      cwd: workspacePath,
      nodir: true,
      absolute: true,
      follow: false,
      dot: true,
      ignore: {
        ignored: p => {
          if (input.excludePattern) {
            const mm = new RegExp(input.excludePattern)
            if (mm.test(p.relative())) return true
          }
          return shouldIgnore(p.fullpath())
        }
      }
    })

    const matches: Array<{
      relativePath: string
      lineNumber: number
      content: string
    }> = []

    // Search through each file
    for (const file of files) {
      const content = await vfs.readFilePro(file, 'utf-8')
      const lines = content.split('\n')
      const regex = new RegExp(input.query, input.caseSensitive ? 'g' : 'gi')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (regex.test(line)) {
          matches.push({
            relativePath: file.slice(workspacePath.length + 1),
            lineNumber: i + 1,
            content: line.trim()
          })

          if (matches.length >= 50) break
        }
      }

      if (matches.length >= 50) break
    }

    return { matches }
  }
}
