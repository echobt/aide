import { Tool } from '@langchain/core/tools'
import {
  ListToolsResult,
  type ListPromptsResult,
  type ListResourcesResult,
  type ListResourceTemplatesResult
} from '@modelcontextprotocol/sdk/types.js'
import { settledPromiseResults } from '@shared/utils/common'

import { MCPConnection, MCPConnectionManager } from './mcp-connection-manager'
import { createLangchainTool } from './mcp-tool-utils'

interface ResourceCache {
  tools: ListToolsResult | null
  prompts: ListPromptsResult | null
  resources: ListResourcesResult | null
  resourceTemplates: ListResourceTemplatesResult | null
}

export class MCPResourceManager {
  private static instance: MCPResourceManager

  // Cache storage for multiple connections
  private cacheMap: Map<string, ResourceCache> = new Map()

  // Add connection manager
  private connectionManager: MCPConnectionManager

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {
    // Get connection manager instance
    this.connectionManager = MCPConnectionManager.getInstance()
  }

  static getInstance(): MCPResourceManager {
    if (!MCPResourceManager.instance) {
      MCPResourceManager.instance = new MCPResourceManager()
    }
    return MCPResourceManager.instance
  }

  private getConnection(id: string): MCPConnection {
    // Use connection manager to get connection
    const connection = this.connectionManager.getConnection(id)
    if (!connection) {
      throw new Error(`MCP connection ${id} not initialized`)
    }
    return connection
  }

  private getCache(id: string): ResourceCache {
    const cache = this.cacheMap.get(id)
    if (!cache) {
      throw new Error(`Cache for connection ${id} not found`)
    }
    return cache
  }

  // Tools management
  async getTools(connectionId: string): Promise<ListToolsResult> {
    const connection = this.getConnection(connectionId)
    const cache = this.getCache(connectionId)

    if (!cache.tools) {
      cache.tools = await connection.client.listTools()
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
            argsSchema: tool.inputSchema
          })
      )
    )
  }

  // Prompts management
  async getPrompts(connectionId: string): Promise<ListPromptsResult> {
    const connection = this.getConnection(connectionId)
    const cache = this.getCache(connectionId)

    if (!cache.prompts) {
      cache.prompts = await connection.client.listPrompts()
    }
    return cache.prompts
  }

  // Resources management
  async getResources(connectionId: string): Promise<ListResourcesResult> {
    const connection = this.getConnection(connectionId)
    const cache = this.getCache(connectionId)

    if (!cache.resources) {
      cache.resources = await connection.client.listResources()
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
      cache.resourceTemplates = await connection.client.listResourceTemplates()
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
