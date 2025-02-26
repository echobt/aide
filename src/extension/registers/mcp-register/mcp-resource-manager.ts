import { logger } from '@extension/logger'
import { Tool } from '@langchain/core/tools'
import {
  ListToolsResult,
  type ListPromptsResult,
  type ListResourcesResult,
  type ListResourceTemplatesResult
} from '@modelcontextprotocol/sdk/types.js'
import { settledPromiseResults } from '@shared/utils/common'
import { t } from 'i18next'

import { McpConnection, McpConnectionManager } from './mcp-connection-manager'
import { createLangchainTool } from './mcp-tool-utils'

interface ResourceCache {
  tools: ListToolsResult | null
  prompts: ListPromptsResult | null
  resources: ListResourcesResult | null
  resourceTemplates: ListResourceTemplatesResult | null
}

export class McpResourceManager {
  private static instance: McpResourceManager

  // Cache storage for multiple connections
  private cacheMap: Map<string, ResourceCache> = new Map()

  // Add connection manager
  private connectionManager: McpConnectionManager

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {
    // Get connection manager instance
    this.connectionManager = McpConnectionManager.getInstance()
  }

  static getInstance(): McpResourceManager {
    if (!McpResourceManager.instance) {
      McpResourceManager.instance = new McpResourceManager()
    }
    return McpResourceManager.instance
  }

  private getConnection(id: string): McpConnection {
    // Use connection manager to get connection
    const connection = this.connectionManager.getConnection(id)
    if (!connection) {
      throw new Error(
        t('extension.mcp.errors.connectionNotInitialized', { id })
      )
    }
    return connection
  }

  private getCache(id: string): ResourceCache {
    const cache = this.cacheMap.get(id)
    if (!cache) {
      this.cacheMap.set(id, {
        tools: null,
        prompts: null,
        resources: null,
        resourceTemplates: null
      })
    }
    return this.cacheMap.get(id)!
  }

  // Tools management
  async getTools(connectionId: string): Promise<ListToolsResult> {
    const connection = this.getConnection(connectionId)
    const cache = this.getCache(connectionId)

    if (!cache.tools) {
      try {
        cache.tools = await connection.client.listTools()
      } catch (error) {
        logger.dev.warn(
          `Failed to get tools for connection ${connectionId}`,
          error
        )
        cache.tools = {
          tools: [],
          nextCursor: undefined
        }
      }
    }
    return cache.tools
  }

  async getLangchainTools(connectionId: string): Promise<Tool[]> {
    const connection = this.getConnection(connectionId)
    const tools = await this.getTools(connectionId)

    return await settledPromiseResults(
      tools.tools.map(
        async tool =>
          await createLangchainTool({
            client: connection.client,
            name: tool.name,
            description: tool.description || '',
            inputSchema: tool.inputSchema
          })
      )
    )
  }

  // Prompts management
  async getPrompts(connectionId: string): Promise<ListPromptsResult> {
    const connection = this.getConnection(connectionId)
    const cache = this.getCache(connectionId)

    if (!cache.prompts) {
      try {
        cache.prompts = await connection.client.listPrompts()
      } catch (error) {
        logger.dev.warn(
          `Failed to get prompts for connection ${connectionId}`,
          error
        )
        cache.prompts = {
          prompts: [],
          nextCursor: undefined
        }
      }
    }
    return cache.prompts
  }

  // Resources management
  async getResources(connectionId: string): Promise<ListResourcesResult> {
    const connection = this.getConnection(connectionId)
    const cache = this.getCache(connectionId)

    if (!cache.resources) {
      try {
        cache.resources = await connection.client.listResources()
      } catch (error) {
        logger.dev.warn(
          `Failed to get resources for connection ${connectionId}`,
          error
        )
        cache.resources = {
          resources: [],
          nextCursor: undefined
        }
      }
    }
    return cache.resources
  }

  // Resource templates management
  async getResourceTemplates(
    connectionId: string
  ): Promise<ListResourceTemplatesResult> {
    const connection = this.getConnection(connectionId)
    const cache = this.getCache(connectionId)

    if (!cache.resourceTemplates) {
      try {
        cache.resourceTemplates =
          await connection.client.listResourceTemplates()
      } catch (error) {
        logger.dev.warn(
          `Failed to get resource templates for connection ${connectionId}`,
          error
        )
        cache.resourceTemplates = {
          resourceTemplates: [],
          nextCursor: undefined
        }
      }
    }
    return cache.resourceTemplates
  }

  // Refresh methods
  async refreshTools(connectionId: string): Promise<ListToolsResult> {
    const connection = this.getConnection(connectionId)
    const cache = this.getCache(connectionId)

    cache.tools = await connection.client.listTools()
    return cache.tools
  }

  async refreshPrompts(connectionId: string): Promise<ListPromptsResult> {
    const connection = this.getConnection(connectionId)
    const cache = this.getCache(connectionId)

    cache.prompts = await connection.client.listPrompts()
    return cache.prompts
  }

  async refreshResources(connectionId: string): Promise<ListResourcesResult> {
    const connection = this.getConnection(connectionId)
    const cache = this.getCache(connectionId)

    cache.resources = await connection.client.listResources()
    return cache.resources
  }

  async refreshResourceTemplates(
    connectionId: string
  ): Promise<ListResourceTemplatesResult> {
    const connection = this.getConnection(connectionId)
    const cache = this.getCache(connectionId)

    cache.resourceTemplates = await connection.client.listResourceTemplates()
    return cache.resourceTemplates
  }

  // Refresh all caches for a connection
  async refreshAll(connectionId: string): Promise<void> {
    await Promise.all([
      this.refreshTools(connectionId),
      this.refreshPrompts(connectionId),
      this.refreshResources(connectionId),
      this.refreshResourceTemplates(connectionId)
    ])
  }

  clearCacheByConnectionId(connectionId: string): void {
    try {
      const cache = this.getCache(connectionId)
      cache.tools = null
      cache.prompts = null
      cache.resources = null
      cache.resourceTemplates = null
    } catch (error) {
      logger.dev.error(
        `Failed to clear cache for connection ${connectionId}`,
        error
      )
    }
  }

  // Clear specific cache for a connection
  clearToolsCache(connectionId: string): void {
    const cache = this.getCache(connectionId)
    cache.tools = null
  }

  clearPromptsCache(connectionId: string): void {
    const cache = this.getCache(connectionId)
    cache.prompts = null
  }

  clearResourcesCache(connectionId: string): void {
    const cache = this.getCache(connectionId)
    cache.resources = null
  }

  clearResourceTemplatesCache(connectionId: string): void {
    const cache = this.getCache(connectionId)
    cache.resourceTemplates = null
  }

  // Clear all caches for a connection
  clearAllCaches(connectionId: string): void {
    const cache = this.getCache(connectionId)
    cache.tools = null
    cache.prompts = null
    cache.resources = null
    cache.resourceTemplates = null
  }

  // Remove a connection and its cache
  removeConnection(connectionId: string): void {
    this.cacheMap.delete(connectionId)
  }

  // Dispose all connections and caches
  dispose(): void {
    this.cacheMap.clear()
  }
}
