import { logger } from '@extension/logger'
import { mcpDB } from '@extension/lowdb/mcp-db'
import {
  McpConnectionManager,
  type McpConnectionStatus
} from '@extension/registers/mcp-register/mcp-connection-manager'
import { McpRegister } from '@extension/registers/mcp-register/mcp-register'
import { McpResourceManager } from '@extension/registers/mcp-register/mcp-resource-manager'
import { createTransport } from '@extension/registers/mcp-register/mcp-tool-utils'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type {
  ListPromptsResult,
  ListToolsResult
} from '@modelcontextprotocol/sdk/types.js'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import {
  mcpConfigSchema,
  type McpConfig,
  type TransportOptions
} from '@shared/entities'
import { settledPromiseResults } from '@shared/utils/common'
import { t } from 'i18next'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

export type McpConfigWithStatus = McpConfig & {
  status: McpConnectionStatus
}

export type McpConfigWithFullInfo = McpConfigWithStatus & {
  listTools: ListToolsResult
  listPrompts: ListPromptsResult
}

export class McpActionsCollection extends ServerActionCollection {
  readonly categoryName = 'mcp'

  private async validateConfig(
    data: Partial<McpConfig>,
    excludeId?: string
  ): Promise<void> {
    const configs = await mcpDB.getAll()
    const existingConfig = configs.find(c => c.name === data.name)
    if (existingConfig) {
      throw new Error(t('extension.mcp.errors.nameInUse'))
    }

    const schema = mcpConfigSchema.extend({
      name: z
        .string()
        .min(1, t('extension.mcp.validation.nameRequired'))
        .refine(
          async name =>
            !configs.some(c => c.name === name && c.id !== excludeId),
          {
            message: t('extension.mcp.validation.nameUnique')
          }
        )
    })
    await schema.parseAsync(data)
  }

  async getConfigs(context: ActionContext<{ query?: string }>) {
    const { actionParams } = context
    const { query } = actionParams
    const configs = await mcpDB.getAll()

    if (!query) return configs

    return configs.filter(
      config =>
        config.name.toLowerCase().includes(query.toLowerCase()) ||
        config.description?.toLowerCase().includes(query.toLowerCase())
    )
  }

  async getConfigsWithStatus(
    context: ActionContext<{ query?: string }>
  ): Promise<Array<McpConfigWithStatus>> {
    const configs = await this.getConfigs(context)

    return configs.map(config => ({
      ...config,
      status: McpConnectionManager.getInstance().getConnectionStatus(config.id)
    }))
  }

  async getConfigsWithFullInfo(
    context: ActionContext<{ query?: string }>
  ): Promise<Array<McpConfigWithFullInfo>> {
    const configsWithStatus = await this.getConfigsWithStatus(context)

    const configsWithFullInfo = await settledPromiseResults(
      configsWithStatus.map(async config => {
        const listTools = await McpResourceManager.getInstance().getTools(
          config.id
        )
        const listPrompts = await McpResourceManager.getInstance().getPrompts(
          config.id
        )

        return {
          ...config,
          listTools,
          listPrompts
        }
      })
    )

    return configsWithFullInfo
  }

  async addConfig(
    context: ActionContext<
      Omit<McpConfig, 'id'> & {
        autoTestConnection?: boolean
      }
    >
  ) {
    const { actionParams } = context
    const { autoTestConnection = true } = actionParams

    await this.validateConfig(actionParams)

    const configForSave: McpConfig = {
      ...actionParams,
      id: uuidv4()
    }

    if (configForSave.isEnabled) {
      // if enabled, create connection
      await McpConnectionManager.getInstance().createConnection(
        configForSave.id,
        configForSave.transportConfig
      )
    } else if (autoTestConnection) {
      // if not enabled but autoTestConnection is true, test connection
      await this.testConnectionByConfig({
        ...context,
        actionParams: { transportConfig: configForSave.transportConfig }
      })
    }

    const config = await mcpDB.add(configForSave)

    return config
  }

  async updateConfig(
    context: ActionContext<
      {
        id: string
      } & Partial<McpConfig>
    >
  ) {
    const { actionParams } = context
    const { id, ...updates } = actionParams

    const allConfigs = await mcpDB.getAll()
    const oldConfig = allConfigs.find(c => c.id === id)
    if (!oldConfig) throw new Error('Config not found')
    const configForSave: McpConfig = {
      ...oldConfig,
      ...updates,
      id
    }

    if (configForSave.isEnabled) {
      // if enabled, recreate connection with new config
      await McpConnectionManager.getInstance().recreateConnection(
        configForSave.id,
        configForSave.transportConfig
      )
    } else {
      // if not enabled, dispose connection
      await McpConnectionManager.getInstance().disposeConnection(
        configForSave.id
      )
    }

    const config = await mcpDB.update(id, configForSave)!
    await McpResourceManager.getInstance().clearCacheByConnectionId(id)

    return config
  }

  async removeConfig(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    const { id } = actionParams

    await mcpDB.remove(id)
    await McpConnectionManager.getInstance().disposeConnection(id)
  }

  async removeConfigs(context: ActionContext<{ ids: string[] }>) {
    const { actionParams } = context
    const { ids } = actionParams

    await mcpDB.batchRemove(ids)
    await settledPromiseResults(
      ids.map(
        async id =>
          await McpConnectionManager.getInstance().disposeConnection(id)
      )
    )
  }

  async reconnectById(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    const { id } = actionParams

    const config = (await mcpDB.getAll()).find(c => c.id === id)
    if (!config) throw new Error(t('extension.mcp.errors.configNotFound'))

    await McpConnectionManager.getInstance().recreateConnection(
      id,
      config.transportConfig
    )
  }

  async ensureConnection(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    const { id } = actionParams

    const config = (await mcpDB.getAll()).find(c => c.id === id)
    if (!config) throw new Error(t('extension.mcp.errors.configNotFound'))

    return await McpConnectionManager.getInstance().ensureConnection(
      id,
      config.transportConfig
    )
  }

  async resolveDBMcpConnectPromise(context: ActionContext<{}>) {
    const mcpRegister = this.registerManager.getRegister(McpRegister)
    if (!mcpRegister) return { success: false }
    await mcpRegister.globalMcpConnectPromise
    return { success: true }
  }

  async testConnectionByConfig(
    context: ActionContext<{
      transportConfig: TransportOptions
    }>
  ) {
    const { actionParams } = context
    const { transportConfig } = actionParams

    let client: Client | undefined
    let transport: Transport | undefined

    try {
      // Create a temporary connection for testing
      transport = createTransport(transportConfig)
      client = new Client(
        {
          name: 'aide-client-test',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      )

      // Try to connect
      await client.connect(transport)

      // Test basic functionality by listing tools
      await client.listTools()
    } finally {
      // Ensure resources are always cleaned up
      if (client) {
        try {
          await client.close()
        } catch (closeError) {
          logger.error('Error closing MCP client:', closeError)
        }
      }
    }
  }

  async testConnectionById(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    const { id } = actionParams

    const config = (await mcpDB.getAll()).find(c => c.id === id)
    if (!config) throw new Error(t('extension.mcp.errors.configNotFound'))

    await this.testConnectionByConfig({
      ...context,
      actionParams: { transportConfig: config.transportConfig }
    })
  }

  async getTools(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    const { id } = actionParams

    return McpResourceManager.getInstance().getTools(id)
  }

  async getPrompts(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    const { id } = actionParams

    return McpResourceManager.getInstance().getPrompts(id)
  }
}
