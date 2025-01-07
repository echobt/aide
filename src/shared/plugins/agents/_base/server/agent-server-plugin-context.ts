import type { AgentPluginId } from '../types'
import type { AgentServerPluginRegistry } from './agent-server-plugin-registry'
import type { createAgentProviderManagers } from './create-agent-provider-manager'

export interface AgentServerPlugin {
  id: AgentPluginId
  version: string
  dependencies?: AgentPluginId[]
  activate(context: AgentServerPluginContext): Promise<void>
  deactivate?(): void
}

interface AgentServerPluginContextOptions {
  pluginId: AgentPluginId
  registry: AgentServerPluginRegistry
}

// eslint-disable-next-line unused-imports/no-unused-vars
export class AgentServerPluginContext {
  private pluginId: AgentPluginId

  private registry: AgentServerPluginRegistry

  constructor(options: AgentServerPluginContextOptions) {
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
    K extends keyof AgentServerPluginRegistry['providerManagers']
  >(
    key: K,
    provider: Parameters<
      ReturnType<typeof createAgentProviderManagers>[K]['register']
    >[1]
  ): void {
    this.registry.providerManagers[key].register(this.pluginId, provider as any)
  }
}
