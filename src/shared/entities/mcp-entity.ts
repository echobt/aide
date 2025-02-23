import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js'
import type {
  ListPromptsResult,
  ListToolsResult
} from '@modelcontextprotocol/sdk/types.js'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

import { BaseEntity, type IBaseEntity } from './base-entity'

export type McpTool = ListToolsResult['tools'][number]
export type McpPrompt = ListPromptsResult['prompts'][number]

export interface SseClientTransportOptions {
  type: 'sse'
  url: string
  eventSourceInit?: EventSourceInit
  requestInit?: RequestInit
}

export interface StdioClientTransportOptions extends StdioServerParameters {
  type: 'stdio'
}

export interface WebSocketClientTransportOptions {
  type: 'websocket'
  url: string
}

export type TransportOptions =
  | SseClientTransportOptions
  | StdioClientTransportOptions
  | WebSocketClientTransportOptions

export interface McpConfig extends IBaseEntity {
  // Basic info
  name: string
  description?: string

  // Transport configuration
  transportConfig: TransportOptions

  // Status tracking
  isEnabled: boolean
}

export class McpEntity extends BaseEntity<McpConfig> {
  protected getDefaults(override?: Partial<McpConfig>): McpConfig {
    return {
      id: uuidv4(),
      name: '',
      description: '',
      isEnabled: true,
      transportConfig: {
        type: 'stdio',
        command: ''
      },
      ...override
    }
  }
}

export const mcpConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  transportConfig: z.discriminatedUnion('type', [
    // stdio transport
    z.object({
      type: z.literal('stdio'),
      command: z.string().min(1, 'Command is required'),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional()
    }),

    // websocket transport
    z.object({
      type: z.literal('websocket'),
      url: z.string().url('Invalid WebSocket URL')
    }),

    // sse transport
    z.object({
      type: z.literal('sse'),
      url: z.string().url('Invalid SSE URL'),
      eventSourceInit: z
        .object({
          withCredentials: z.boolean().optional()
        })
        .optional(),
      requestInit: z.any().optional()
    })
  ])
}) satisfies z.ZodType<Partial<McpConfig>>
