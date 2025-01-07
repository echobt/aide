import { logger } from '@extension/logger'

import type { AgentPluginId } from '../types'
import {
  AgentServerPluginContext,
  type AgentServerPlugin
} from './agent-server-plugin-context'
import { createAgentProviderManagers } from './create-agent-provider-manager'

export class AgentServerPluginRegistry {
  private plugins: Map<AgentPluginId, AgentServerPlugin> = new Map()

  private pluginContexts: Map<AgentPluginId, AgentServerPluginContext> =
    new Map()

  private commands: Map<string, (...args: any[]) => void> = new Map()

  providerManagers = createAgentProviderManagers()

  private checkDependencies(plugin: AgentServerPlugin): boolean {
    return (
      !plugin.dependencies ||
      plugin.dependencies.every(depId => this.plugins.has(depId))
    )
  }

  async loadPlugin(_plugin: AgentServerPlugin): Promise<void> {
    let currentPluginId: AgentPluginId | null = null

    try {
      const plugin = _plugin as AgentServerPlugin
      currentPluginId = plugin.id

      if (!this.checkDependencies(plugin))
        throw new Error(`Dependencies not met for plugin ${currentPluginId}`)

      this.plugins.set(currentPluginId, plugin)
      const context = new AgentServerPluginContext({
        registry: this,
        pluginId: currentPluginId
      })
      this.pluginContexts.set(currentPluginId, context)
      await plugin.activate(context)
    } catch (error: any) {
      this.handleError(error, currentPluginId)
    } finally {
      currentPluginId = null
    }
  }

  private handleError(error: Error, pluginId: AgentPluginId | null): void {
    logger.error(`Error in plugin ${pluginId}:`, error)
  }

  registerCommand(command: string, callback: (...args: any[]) => void): void {
    this.commands.set(command, callback)
  }

  executeCommand(command: string, ...args: any[]): void {
    const callback = this.commands.get(command)
    if (callback) callback(...args)
  }

  getPlugin<T extends AgentServerPlugin>(
    pluginId: AgentPluginId
  ): T | undefined {
    return this.plugins.get(pluginId) as T
  }

  async unloadPlugin(pluginId: AgentPluginId): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (plugin?.deactivate) {
      await plugin.deactivate()
    }
    this.plugins.delete(pluginId)
    Object.values(this.providerManagers).forEach(manager =>
      manager.unregister(pluginId)
    )
  }

  async unloadAllPlugins(): Promise<void> {
    for (const pluginId of this.plugins.keys()) {
      await this.unloadPlugin(pluginId)
    }
  }
}
