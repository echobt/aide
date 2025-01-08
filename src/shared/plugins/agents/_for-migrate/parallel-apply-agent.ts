import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { runAction } from '@extension/state'
import { z } from 'zod'

import { parallelApplyAgentName } from './agent-names'

export class ParallelApplyAgent extends BaseAgent<BaseGraphState, {}> {
  static name = parallelApplyAgentName

  name = ParallelApplyAgent.name

  logTitle = 'Parallel Apply'

  description = `When there are multiple locations that can be edited in parallel, with a similar type of edit, use this tool to sketch out a plan for the edits.
You should start with the editPlan which describes what the edits will be.
Then, write out the files that will be edited with the editRegions argument.
You shouldn't edit more than 50 files at a time.`

  inputSchema = z.object({
    editPlan: z
      .string()
      .describe(
        'A detailed description of the parallel edits to be applied.\n' +
          'They should be specified in a way where a model just seeing one of the files and this plan would be able to apply the edits to any of the files.\n' +
          'It should be in the first person, describing what you will do on another iteration, after seeing the file.'
      ),
    editRegions: z.array(
      z.object({
        relativeWorkspacePath: z
          .string()
          .describe('The path to the file to edit.'),
        startLine: z
          .number()
          .optional()
          .describe(
            'The start line of the region to edit. 1-indexed and inclusive.'
          ),
        endLine: z
          .number()
          .optional()
          .describe(
            'The end line of the region to edit. 1-indexed and inclusive.'
          )
      })
    )
  })

  outputSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
    results: z.array(
      z.object({
        filePath: z.string(),
        success: z.boolean(),
        error: z.string().optional()
      })
    )
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    if (input.editRegions.length > 50) {
      return {
        success: false,
        error: 'Cannot edit more than 50 files at once',
        results: []
      }
    }

    const results = await Promise.all(
      input.editRegions.map(async region => {
        try {
          const fullPath = await runAction(
            this.context.strategyOptions.registerManager
          ).server.file.getFullPath({
            actionParams: {
              path: region.relativeWorkspacePath,
              returnNullIfNotExists: false
            }
          })

          console.log('Processing file:', fullPath)

          // TODO: add task action to apply parallel edits

          return {
            filePath: region.relativeWorkspacePath,
            success: true
          }
        } catch (error) {
          return {
            filePath: region.relativeWorkspacePath,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      })
    )

    const hasErrors = results.some(result => !result.success)

    return {
      success: !hasErrors,
      error: hasErrors ? 'Some files failed to process' : undefined,
      results
    }
  }
}
