import { BaseAgent } from '@extension/chat/strategies/_base'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { runAction } from '@extension/state'
import { JsonSchema, jsonSchemaToZod } from '@n8n/json-schema-to-zod'
import type { McpTool } from '@shared/entities'
import { z } from 'zod'

export const createMcpToolAgentClass = (mcpConfigId: string, tool: McpTool) => {
  class McpToolAgent extends BaseAgent<BaseGraphState, {}> {
    static name = tool.name

    name = tool.name

    description = tool.description || ''

    inputSchema = jsonSchemaToZod(tool.inputSchema as JsonSchema) || z.any()

    outputSchema = z.any()

    async execute(input: z.infer<typeof this.inputSchema>) {
      const connection = await runAction(
        this.context.strategyOptions.registerManager
      ).server.mcp.ensureConnection({
        actionParams: {
          id: mcpConfigId
        }
      })

      const { content } = await connection.client.callTool({
        name: tool.name,
        arguments: input
      })

      return { content }
    }
  }

  return McpToolAgent
}
