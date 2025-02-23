import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import type { WebPreviewProject } from '@shared/entities'
import { z } from 'zod'

import { AgentPluginId } from '../../_base/types'

export class WebPreviewAgent extends BaseAgent<BaseGraphState, {}> {
  static name = AgentPluginId.WebPreview

  name = WebPreviewAgent.name

  type = 'normal' as const

  description = 'Preview the web page'

  inputSchema = z.object({
    name: z.string().describe('The project name to use for the web preview.'),
    presetName: z
      .string()
      .describe('The preset name to use for the web preview.'),
    files: z
      .array(
        z.object({
          path: z.string(),
          content: z.string()
        })
      )
      .describe('The files to use for the web preview.')
  }) satisfies z.ZodType<Omit<WebPreviewProject, 'id'>>

  outputSchema = z.object({
    success: z.boolean(),
    error: z.string().optional()
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    console.log('files', input.files)

    // TODO: add task action to edit file
  }
}
