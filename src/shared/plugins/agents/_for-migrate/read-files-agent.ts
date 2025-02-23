import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { vfs } from '@extension/file-utils/vfs'
import { workspaceSchemeHandler } from '@extension/file-utils/vfs/schemes/workspace-scheme'
import { logger } from '@extension/logger'
import { settledPromiseResults } from '@shared/utils/common'
import { z } from 'zod'

import { readFilesAgentName } from './agent-names'

export class ReadFilesAgent extends BaseAgent<BaseGraphState, {}> {
  static name = readFilesAgentName

  name = ReadFilesAgent.name

  type = 'normal' as const

  logTitle = 'Read Files'

  description = `Read the contents of multiple files (and the outline).

When using this tool to gather information, it's your responsibility to ensure you have the COMPLETE context. Each time you call this command you should:
1) Assess if contents viewed are sufficient to proceed with the task.
2) Take note of lines not shown.
3) If file contents viewed are insufficient, and you suspect they may be in lines not shown, proactively call the tool again to view those lines.
4) When in doubt, call this tool again to gather more information. Partial file views may miss critical dependencies, imports, or functionality.

If reading a range of lines is not enough, you may choose to read the entire file.
Reading entire files is often wasteful and slow, especially for large files (i.e. more than a few hundred lines). So you should use this option sparingly.
Reading the entire file is not allowed in most cases. You are only allowed to read the entire file if it has been edited or manually attached to the conversation by the user.`

  inputSchema = z.object({
    files: z.array(
      z.object({
        relativePath: z
          .string()
          .describe(
            'The path of the file to read, relative to the workspace root.'
          ),
        shouldReadEntireFile: z
          .boolean()
          .describe('Whether to read the entire file. Defaults to false.'),
        startLineOneIndexed: z
          .number()
          .describe(
            'The one-indexed line number to start reading from (inclusive).'
          ),
        endLineOneIndexedInclusive: z
          .number()
          .describe(
            'The one-indexed line number to end reading at (inclusive).'
          )
      })
    ),
    explanation: z
      .string()
      .optional()
      .describe(
        'One sentence explanation as to why this tool is being used, and how it contributes to the goal.'
      )
  })

  outputSchema = z.object({
    content: z.string(),
    schemeUri: z.string(),
    startLine: z.number(),
    endLine: z.number()
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    const results = await settledPromiseResults(
      input.files.map(async inputFile => {
        const fullPath = await vfs.resolveFullPathProAsync(
          inputFile.relativePath,
          false
        )

        const schemeUri = workspaceSchemeHandler.createSchemeUri({
          fullPath
        })

        let fileContent = ''

        try {
          if (fullPath) {
            fileContent = await vfs.readFilePro(fullPath, 'utf-8')
          }
        } catch (e) {
          logger.error('Failed to read file', {
            fullPath,
            error: e
          })
        }

        if (inputFile.shouldReadEntireFile) {
          return {
            content: fileContent,
            schemeUri,
            startLine: 1,
            endLine: fileContent.split('\n').length
          }
        }

        const lines = fileContent.split('\n')
        const selectedLines = lines.slice(
          inputFile.startLineOneIndexed - 1,
          inputFile.endLineOneIndexedInclusive
        )

        return {
          content: selectedLines.join('\n'),
          schemeUri,
          startLine: inputFile.startLineOneIndexed,
          endLine: inputFile.endLineOneIndexedInclusive
        }
      })
    )

    return results
  }
}
