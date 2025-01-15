import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { getFileHash } from '@extension/file-utils/get-file-hash'
import { vfs } from '@extension/file-utils/vfs'
import { workspaceSchemeHandler } from '@extension/file-utils/vfs/schemes/workspace-scheme'
import { settledPromiseResults } from '@shared/utils/common'
import { z } from 'zod'

import { AgentPluginId } from '../../_base/types'
import type { CodeSnippet } from '../../codebase-search-agent-plugin/types'

export class ReadFilesAgent extends BaseAgent<BaseGraphState, {}> {
  static name = AgentPluginId.ReadFiles

  name = ReadFilesAgent.name

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
    codeSnippets: z.array(
      z.object({
        fileHash: z.string(),
        schemeUri: z.string(),
        startLine: z.number(),
        startCharacter: z.number(),
        endLine: z.number(),
        endCharacter: z.number(),
        code: z.string()
      }) satisfies z.ZodType<CodeSnippet>
    )
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    const codeSnippets = await settledPromiseResults(
      input.files.map(async inputFile => {
        const fullPath = await vfs.resolveFullPathProAsync(
          inputFile.relativePath,
          false
        )

        if (!fullPath)
          throw new Error(`File not found:${inputFile.relativePath}`)

        const schemeUri = workspaceSchemeHandler.createSchemeUri({
          fullPath
        })

        const fileContent = await vfs.readFilePro(schemeUri, 'utf-8')

        const lines = fileContent.split('\n')
        const startLine = inputFile.shouldReadEntireFile
          ? 1
          : inputFile.startLineOneIndexed
        const endLine = inputFile.shouldReadEntireFile
          ? lines.length
          : inputFile.endLineOneIndexedInclusive

        const selectedLines = lines.slice(startLine - 1, endLine)
        const code = selectedLines.join('\n')

        const fileHash = await getFileHash(schemeUri)

        return {
          fileHash,
          schemeUri,
          startLine,
          startCharacter: 0,
          endLine,
          endCharacter: selectedLines[selectedLines.length - 1]?.length ?? 0,
          code
        } satisfies CodeSnippet
      })
    )

    return {
      codeSnippets
    }
  }
}
