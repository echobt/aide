import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { runAction } from '@extension/state'
import { z } from 'zod'

import { editFileAgentName } from './agent-names'

export class EditFileAgent extends BaseAgent<BaseGraphState, {}> {
  static name = editFileAgentName

  name = EditFileAgent.name

  logTitle = 'Edit File'

  description = `Use this tool to propose an edit to an existing file.
This will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged code you write.
When writing the edit, you should specify each edit in sequence, with the special comment \`// ... existing code ...\` to represent unchanged code in between edited lines.

For example:
\`\`\`
// ... existing code ...
FIRST_EDIT
// ... existing code ...
SECOND_EDIT
// ... existing code ...
THIRD_EDIT
// ... existing code ...
\`\`\`

You should bias towards repeating as few lines of the original file as possible to convey the change.
But, each edit should contain sufficient context of unchanged lines around the code you're editing to resolve ambiguity.
DO NOT omit spans of pre-existing code without using the \`// ... existing code ...\` comment to indicate its absence.
Make sure it is clear what the edit should be.`

  inputSchema = z.object({
    targetFilePath: z
      .string()
      .describe(
        'The target file path to modify. Always specify the target file as the first argument and use the relative path in the workspace of the file to edit'
      ),
    instructions: z
      .string()
      .describe(
        'A single sentence instruction describing what you are going to do for the sketched edit. This is used to assist the less intelligent model in applying the edit. Please use the first person to describe what you are going to do.'
      ),
    codeEdit: z
      .string()
      .describe(
        "Specify ONLY the precise lines of code that you wish to edit. **NEVER specify or write out unchanged code**. Instead, represent all unchanged code using the comment of the language you're editing in - example: `// ... existing code ...`"
      ),
    blocking: z
      .boolean()
      .describe(
        'Whether this tool call should block the client from making further edits to the file until this call is complete. If true, the client will not be able to make further edits to the file until this call is complete.'
      )
  })

  outputSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    const fullPath = await runAction(
      this.context.strategyOptions.registerManager
    ).server.file.getFullPath({
      actionParams: {
        path: input.targetFilePath
      }
    })
    console.log('fullPath', fullPath)

    // TODO: add task action to edit file
  }
}
