import { logger } from '@extension/logger'
import { mcpDB } from '@extension/lowdb/mcp-db'
import { settledPromiseResults } from '@shared/utils/common'

import { BaseRegister } from '../base-register'
import { MCPConnectionManager } from './mcp-connection-manager'
import { MCPResourceManager } from './mcp-resource-manager'

export class MCPRegister extends BaseRegister {
  mcpConnectionManager!: MCPConnectionManager

  mcpResourceManager!: MCPResourceManager

  async register(): Promise<void> {
    this.mcpConnectionManager = MCPConnectionManager.getInstance()
    this.mcpResourceManager = MCPResourceManager.getInstance()

    // Connect all enabled configurations from database
    await this.connectAllFromDB()
  }

  private async connectAllFromDB(): Promise<void> {
    const configs = await mcpDB.getAll()
    const enabledConfigs = configs.filter(config => config.isEnabled)

    if (enabledConfigs.length === 0) {
      return
    }

    logger.log(`Connecting to ${enabledConfigs.length} MCP configurations...`)

    await settledPromiseResults(
      enabledConfigs.map(
        async config => {
          await this.mcpConnectionManager.createConnection(
            config.id,
            config.transportConfig
          )
          logger.log(`Connected to MCP: ${config.name}`)
        },
        (error: any) => {
          logger.error(`Failed to connect to MCP:`, error)
        }
      )
    )
  }

  async dispose(): Promise<void> {
    this.mcpResourceManager.dispose()
    await this.mcpConnectionManager.dispose()
  }
}
