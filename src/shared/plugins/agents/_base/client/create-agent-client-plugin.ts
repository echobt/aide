import { AgentPluginId } from '../types'
import { useAgentPlugin } from './agent-client-plugin-context'
import type { AgentClientPluginProviderMap } from './agent-client-plugin-types'

export interface AgentClientPlugin {
  id: AgentPluginId
  version: string
  usePlugin: () => void
}

export type AgentClientPluginSetupProps = {
  registerProvider: <K extends keyof AgentClientPluginProviderMap>(
    providerKey: K,
    provider: () => AgentClientPluginProviderMap[K]
  ) => void
}

export const createAgentClientPlugin = (options: {
  id: AgentPluginId
  version: string
  setup: (context: AgentClientPluginSetupProps) => void
}): AgentClientPlugin => ({
  id: options.id,
  version: options.version,
  usePlugin() {
    const { registerProvider } = useAgentPlugin()

    options.setup({
      registerProvider: (key, provider) =>
        registerProvider(
          options.id,
          key as keyof AgentClientPluginProviderMap,
          provider as () => AgentClientPluginProviderMap[keyof AgentClientPluginProviderMap]
        )
    })
  }
})
