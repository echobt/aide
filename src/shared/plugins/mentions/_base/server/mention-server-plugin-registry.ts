import { logger } from '@extension/logger'

import type { MentionPluginId } from '../types'
import { createMentionProviderManagers } from './create-mention-provider-manager'
import {
  MentionServerPluginContext,
  type MentionServerPlugin
} from './mention-server-plugin-context'

export class MentionServerPluginRegistry {
  private plugins: Map<MentionPluginId, MentionServerPlugin> = new Map()

  private pluginContexts: Map<MentionPluginId, MentionServerPluginContext> =
    new Map()

  private commands: Map<string, (...args: any[]) => void> = new Map()

  providerManagers = createMentionProviderManagers()

  private checkDependencies(plugin: MentionServerPlugin): boolean {
    return (
      !plugin.dependencies ||
      plugin.dependencies.every(depId => this.plugins.has(depId))
    )
  }

  async loadPlugin(_plugin: MentionServerPlugin): Promise<void> {
    let currentPluginId: MentionPluginId | null = null

    try {
      const plugin = _plugin as MentionServerPlugin
      currentPluginId = plugin.id

      if (!this.checkDependencies(plugin))
        throw new Error(`Dependencies not met for plugin ${currentPluginId}`)

      this.plugins.set(currentPluginId, plugin)
      const context = new MentionServerPluginContext({
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

  private handleError(error: Error, pluginId: MentionPluginId | null): void {
    logger.error(`Error in plugin ${pluginId}:`, error)
  }

  registerCommand(command: string, callback: (...args: any[]) => void): void {
    this.commands.set(command, callback)
  }

  executeCommand(command: string, ...args: any[]): void {
    const callback = this.commands.get(command)
    if (callback) callback(...args)
  }

  getPlugin<T extends MentionServerPlugin>(
    pluginId: MentionPluginId
  ): T | undefined {
    return this.plugins.get(pluginId) as T
  }

  async unloadPlugin(pluginId: MentionPluginId): Promise<void> {
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
