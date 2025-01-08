import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { createShouldIgnore } from '@extension/file-utils/ignore-patterns'
import {
  traverseFileOrFolders,
  type FileInfo
} from '@extension/file-utils/traverse-fs'
import { getWorkspaceFolder } from '@extension/utils'
import { z } from 'zod'

import { fileSearchAgentName } from './agent-names'

export class FileSearchAgent extends BaseAgent<BaseGraphState, {}> {
  static name = fileSearchAgentName

  name = FileSearchAgent.name

  logTitle = 'File Search'

  description = `Fast file search based on fuzzy matching against file path. Use if you know part of the file path but don't know where it's located exactly. Response will be capped to 10 results. Make your query more specific if need to filter results further.`

  inputSchema = z.object({
    query: z.string().describe('Fuzzy filename to search for'),
    explanation: z
      .string()
      .describe(
        'One sentence explanation as to why this tool is being used, and how it contributes to the goal.'
      )
  })

  outputSchema = z.object({
    files: z.array(
      z.object({
        type: z.literal('file'),
        relativePath: z.string(),
        fullPath: z.string(),
        content: z.string()
      }) satisfies z.ZodType<FileInfo>
    )
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    const workspaceFolder = getWorkspaceFolder()
    const workspacePath = workspaceFolder.uri.fsPath

    // Create ignore function based on workspace settings
    const shouldIgnore = await createShouldIgnore(workspacePath)

    // Convert query to regex pattern for fuzzy matching
    const queryPattern = input.query
      .split('')
      .map(c => `[^/]*${c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`)
      .join('')
    const regex = new RegExp(queryPattern, 'i')

    const items = await traverseFileOrFolders({
      type: 'file',
      filesOrFolders: ['./'],
      isGetFileContent: false,
      workspacePath,
      customShouldIgnore: filePath => {
        if (shouldIgnore(filePath)) return true
        return !regex.test(filePath)
      },
      itemCallback: item => item
    })

    // Return top 10 results
    return {
      files: items.slice(0, 10)
    }
  }
}
