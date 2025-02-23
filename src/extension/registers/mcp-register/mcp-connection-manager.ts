import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { TransportOptions } from '@shared/entities'
import { getErrorMsg } from '@shared/utils/common'
import { pkg } from '@shared/utils/pkg'

import { createTransport } from './mcp-tool-utils'

export interface MCPConnection {
  client: Client
  transport: Transport
  isConnected: boolean
}

export interface MCPConnectionStatus {
  isConnected: boolean
  lastConnectTime?: number
  lastError?: string
  state: 'connected' | 'disconnected' | 'error'
}

export class MCPConnectionManager {
  private static instance: MCPConnectionManager

  private connections: Map<string, MCPConnection> = new Map()

  private connectionStatus: Map<string, MCPConnectionStatus> = new Map()

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): MCPConnectionManager {
    if (!MCPConnectionManager.instance) {
      MCPConnectionManager.instance = new MCPConnectionManager()
    }
    return MCPConnectionManager.instance
  }

  async createConnection(
    id: string,
    transportOptions: TransportOptions
  ): Promise<MCPConnection> {
    try {
      if (this.connections.has(id)) {
        return this.connections.get(id)!
      }

      const client = new Client(
        {
          name: 'aide-client',
          version: pkg.version
        },
        {
          capabilities: {}
        }
      )
      const transport = createTransport(transportOptions)
      const connection: MCPConnection = {
        client,
        transport,
        isConnected: false
      }

      await this.connectClient(connection)
      this.connections.set(id, connection)

      // Update connection status on success
      this.connectionStatus.set(id, {
        isConnected: true,
        lastConnectTime: Date.now(),
        state: 'connected'
      })

      return connection
    } catch (error) {
      // Update connection status on failure
      this.connectionStatus.set(id, {
        isConnected: false,
        lastError: getErrorMsg(error),
        state: 'error'
      })
      throw error
    }
  }

  private async connectClient(connection: MCPConnection): Promise<void> {
    if (connection.isConnected) return

    try {
      await connection.client.connect(connection.transport)
      connection.isConnected = true
    } catch (error) {
      if (
        !(error instanceof Error && error.message.includes('already started'))
      ) {
        throw error
      }
    }
  }

  getConnection(id: string): MCPConnection | undefined {
    return this.connections.get(id)
  }

  getConnectionStatus(id: string): MCPConnectionStatus {
    return (
      this.connectionStatus.get(id) || {
        isConnected: false,
        state: 'disconnected'
      }
    )
  }

  getAllConnectionStatus(): Map<string, MCPConnectionStatus> {
    return new Map(this.connectionStatus)
  }

  async disposeConnection(id: string): Promise<void> {
    const connection = this.connections.get(id)
    if (connection) {
      try {
        await connection.client.close()
      } finally {
        this.connections.delete(id)
        this.connectionStatus.set(id, {
          isConnected: false,
          state: 'disconnected',
          lastConnectTime: this.connectionStatus.get(id)?.lastConnectTime
        })
      }
    }
  }

  async disposeAllConnections(): Promise<void> {
    const disposals = Array.from(this.connections.keys()).map(id =>
      this.disposeConnection(id)
    )
    await Promise.all(disposals)
  }

  async dispose(): Promise<void> {
    try {
      await this.disposeAllConnections()
    } finally {
      this.connections.clear()
      this.connectionStatus.clear()
    }
  }

  async recreateConnection(
    id: string,
    transportOptions: TransportOptions
  ): Promise<MCPConnection> {
    try {
      // Dispose existing connection if any
      await this.disposeConnection(id)

      // Create new connection
      const connection = await this.createConnection(id, transportOptions)
      return connection
    } catch (error) {
      // Update connection status on failure
      this.connectionStatus.set(id, {
        isConnected: false,
        lastError: getErrorMsg(error),
        state: 'error'
      })
      throw error
    }
  }
}
