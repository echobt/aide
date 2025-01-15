import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { vfs } from '@extension/file-utils/vfs'
import { settledPromiseResults } from '@shared/utils/common'
import { z } from 'zod'

import { deleteFilesAgentName } from './agent-names'

export class DeleteFilesAgent extends BaseAgent<BaseGraphState, {}> {
  static name = deleteFilesAgentName

  name = DeleteFilesAgent.name

  logTitle = 'Delete Files'

  description = `Deletes files at the specified paths. The operation will fail gracefully if:
    - The file doesn't exist
    - The operation is rejected for security reasons
    - The file cannot be deleted`

  inputSchema = z.object({
    targetFilesRelativePaths: z
      .array(z.string())
      .describe(
        'The paths of the files to delete, relative to the workspace root.'
      ),
    explanation: z
      .string()
      .optional()
      .describe(
        'One sentence explanation as to why this tool is being used, and how it contributes to the goal.'
      )
  })

  outputSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    const results = await settledPromiseResults(
      input.targetFilesRelativePaths.map(async targetFileRelativePath => {
        const fullPath = await vfs.resolveFullPathProAsync(
          targetFileRelativePath,
          false
        )
        // TODO: add task action to delete file

        return {
          fullPath,
          relativePath: targetFileRelativePath
        }
      })
    )

    console.log('results', results)
  }
}
