import { logger } from '@extension/logger'
import { mcpDB } from '@extension/lowdb/mcp-db'
import { settledPromiseResults } from '@shared/utils/common'

import { BaseRegister } from '../base-register'
import { McpConnectionManager } from './mcp-connection-manager'
import { McpResourceManager } from './mcp-resource-manager'

export class McpRegister extends BaseRegister {
  mcpConnectionManager!: McpConnectionManager

  mcpResourceManager!: McpResourceManager

  globalMcpConnectPromise: Promise<void> | null = null

  async register(): Promise<void> {
    this.mcpConnectionManager = McpConnectionManager.getInstance()
    this.mcpResourceManager = McpResourceManager.getInstance()

    // Connect all enabled configurations from database
    this.globalMcpConnectPromise = this.connectAllFromDB()
  }

  private async connectAllFromDB(): Promise<void> {
    const configs = await mcpDB.getAll()
    const enabledConfigs = configs.filter(config => config.isEnabled)

    if (enabledConfigs.length === 0) {
      return
    }

    logger.log(`Connecting to ${enabledConfigs.length} Mcp configurations...`)

    await settledPromiseResults(
      enabledConfigs.map(
        async config => {
          await this.mcpConnectionManager.createConnection(
            config.id,
            config.transportConfig
          )
          logger.log(`Connected to Mcp: ${config.name}`)
        },
        (error: any) => {
          logger.error(`Failed to connect to Mcp:`, error)
        }
      )
    )
  }

  async dispose(): Promise<void> {
    this.mcpResourceManager.dispose()
    await this.mcpConnectionManager.dispose()
  }
}
