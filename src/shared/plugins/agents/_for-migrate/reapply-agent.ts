import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { vfs } from '@extension/file-utils/vfs'
import { z } from 'zod'

import { reapplyAgentName } from './agent-names'

export class ReapplyAgent extends BaseAgent<BaseGraphState, {}> {
  static name = reapplyAgentName

  name = ReapplyAgent.name

  type = 'normal' as const

  logTitle = 'Reapply Edit'

  description = `Calls a smarter model to apply the last edit to the specified file.
Use this tool immediately after the result of an editFile tool call ONLY IF the diff is not what you expected, indicating the model applying the changes was not smart enough to follow your instructions.`

  inputSchema = z.object({
    targetFilePath: z
      .string()
      .describe('The relative path to the file to reapply the last edit to.')
  })

  outputSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    const fullPath = await vfs.resolveFullPathProAsync(
      input.targetFilePath,
      false
    )

    console.log('fullPath', fullPath)

    // TODO: add task action to reapply edit
  }
}
