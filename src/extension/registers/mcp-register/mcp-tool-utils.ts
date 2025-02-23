import { getWorkspaceFolder } from '@extension/utils'
import { DynamicStructuredTool, Tool } from '@langchain/core/tools'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js'
import type { TransportOptions } from '@shared/entities'

export const createTransport = (options: TransportOptions) => {
  console.log('env path', process.env.PATH)

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
      throw new Error(`Unsupported transport type: ${(options as any).type}`)
  }
}

export const createLangchainTool = async ({
  client,
  name,
  description,
  argsSchema
}: {
  client: Client
  name: string
  description: string
  argsSchema: any
}): Promise<Tool> =>
  new DynamicStructuredTool({
    name,
    description,
    schema: argsSchema,
    func: async (input): Promise<string> => {
      const res = await client.callTool({
        name,
        arguments: input
      })
      const { content } = res
      return JSON.stringify(content)
    }
  })
