import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { runAction } from '@extension/state'
import { z } from 'zod'

import { runTerminalCmdAgentName } from './agent-names'

export class RunTerminalCmdAgent extends BaseAgent<BaseGraphState, {}> {
  static name = runTerminalCmdAgentName

  name = RunTerminalCmdAgent.name

  logTitle = 'Run Terminal Command'

  description = `PROPOSE a command to run on behalf of the user.
If you have this tool, note that you DO have the ability to run commands directly on the USER's system.

Adhere to these rules:
1. Based on the contents of the conversation, you will be told if you are in the same shell as a previous step or a new shell.
2. If in a new shell, you should \`cd\` to the right directory and do necessary setup in addition to running the command.
3. If in the same shell, the state will persist, no need to do things like \`cd\` to the same directory.
4. For ANY commands that would use a pager, you should append \` | cat\` to the command (or whatever is appropriate). You MUST do this for: git, less, head, tail, more, etc.
5. For commands that are long running/expected to run indefinitely until interruption, please run them in the background. To run jobs in the background, set \`isBackground\` to true rather than changing the details of the command.
6. Dont include any newlines in the command.`

  inputSchema = z.object({
    command: z.string().describe('The terminal command to execute'),
    isBackground: z
      .boolean()
      .describe('Whether the command should be run in the background'),
    explanation: z
      .string()
      .optional()
      .describe(
        'One sentence explanation as to why this command needs to be run and how it contributes to the goal.'
      ),
    requireUserApproval: z
      .boolean()
      .describe(
        "Whether the user must approve the command before it is executed. Only set this to true if the command is safe and if it matches the user's requirements for commands that should be executed automatically."
      )
  })

  outputSchema = z.object({
    output: z.string(),
    exitCode: z.number(),
    command: z.string()
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    const result = await runAction(
      this.context.strategyOptions.registerManager
    ).server.terminal.runTerminalCommand({
      actionParams: {
        command: input.command,
        isBackground: input.isBackground
      }
    })

    // TODO: add task action to run terminal command

    return {
      output: result.output,
      exitCode: result.exitCode,
      command: input.command
    }
  }
}
