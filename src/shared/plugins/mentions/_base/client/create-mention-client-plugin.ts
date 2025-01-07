import { MentionPluginId } from '../types'
import { useMentionPlugin } from './mention-client-plugin-context'
import type { MentionClientPluginProviderMap } from './mention-client-plugin-types'

export interface MentionClientPlugin {
  id: MentionPluginId
  version: string
  usePlugin: () => void
}

export type MentionClientPluginSetupProps = {
  registerProvider: <K extends keyof MentionClientPluginProviderMap>(
    providerKey: K,
    provider: () => MentionClientPluginProviderMap[K]
  ) => void
}

export const createMentionClientPlugin = (options: {
  id: MentionPluginId
  version: string
  setup: (context: MentionClientPluginSetupProps) => void
}): MentionClientPlugin => ({
  id: options.id,
  version: options.version,
  usePlugin() {
    const { registerProvider } = useMentionPlugin()

    options.setup({
      registerProvider: (key, provider) =>
        registerProvider(
          options.id,
          key as keyof MentionClientPluginProviderMap,
          provider as () => MentionClientPluginProviderMap[keyof MentionClientPluginProviderMap]
        )
    })
  }
})
