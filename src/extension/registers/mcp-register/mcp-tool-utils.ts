import { getWorkspaceFolder } from '@extension/utils'
import { DynamicStructuredTool, Tool } from '@langchain/core/tools'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js'
import { JsonSchema, jsonSchemaToZod } from '@n8n/json-schema-to-zod'
import type { TransportOptions } from '@shared/entities'
import { t } from 'i18next'

export const createTransport = (options: TransportOptions) => {
  switch (options.type) {
    case 'stdio':
      return new StdioClientTransport({
        command: options.command,
        args: options.args,
        env: {
          ...options.env,
          ...(process.env.PATH ? { PATH: process.env.PATH } : {})
        },
        cwd: options.cwd || getWorkspaceFolder()?.uri.fsPath
      })
    case 'websocket':
      return new WebSocketClientTransport(new URL(options.url))
    case 'sse':
      return new SSEClientTransport(new URL(options.url), {
        eventSourceInit: options.eventSourceInit,
        requestInit: options.requestInit
      })
    default:
      throw new Error(
        t('extension.mcp.errors.unsupportedTransportType', {
          type: (options as any).type
        })
      )
  }
}

export const createLangchainTool = async ({
  client,
  name,
  description,
  inputSchema
}: {
  client: Client
  name: string
  description: string
  inputSchema: any
}): Promise<Tool> =>
  new DynamicStructuredTool({
    name,
    description,
    schema: jsonSchemaToZod(inputSchema as JsonSchema) as any,
    func: async (input): Promise<string> => {
      const res = await client.callTool({
        name,
        arguments: input
      })
      const { content } = res
      return JSON.stringify(content)
    }
  })
