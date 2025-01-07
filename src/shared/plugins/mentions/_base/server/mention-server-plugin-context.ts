import type { MentionPluginId } from '../types'
import type { createMentionProviderManagers } from './create-mention-provider-manager'
import type { MentionServerPluginRegistry } from './mention-server-plugin-registry'

export interface MentionServerPlugin {
  id: MentionPluginId
  version: string
  dependencies?: MentionPluginId[]
  activate(context: MentionServerPluginContext): Promise<void>
  deactivate?(): void
}

interface MentionServerPluginContextOptions {
  pluginId: MentionPluginId
  registry: MentionServerPluginRegistry
}

// eslint-disable-next-line unused-imports/no-unused-vars
export class MentionServerPluginContext {
  private pluginId: MentionPluginId

  private registry: MentionServerPluginRegistry

  constructor(options: MentionServerPluginContextOptions) {
    const { pluginId, registry } = options
    this.pluginId = pluginId
    this.registry = registry
  }

  registerCommand(command: string, callback: (...args: any[]) => void): void {
    this.registry.registerCommand(command, callback)
  }

  executeCommand(command: string, ...args: any[]): void {
    this.registry.executeCommand(command, ...args)
  }

  registerProvider<
    K extends keyof MentionServerPluginRegistry['providerManagers']
  >(
    key: K,
    provider: Parameters<
      ReturnType<typeof createMentionProviderManagers>[K]['register']
    >[1]
  ): void {
    this.registry.providerManagers[key].register(this.pluginId, provider as any)
  }
}
