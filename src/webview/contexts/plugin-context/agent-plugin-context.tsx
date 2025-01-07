import React, { useMemo } from 'react'
import { AgentClientPluginProvider } from '@shared/plugins/agents/_base/client/agent-client-plugin-context'
import { createAgentClientPlugins } from '@shared/plugins/agents/_base/client/agent-client-plugins'
import type { AgentClientPlugin } from '@shared/plugins/agents/_base/client/create-agent-client-plugin'

export { useAgentPlugin } from '@shared/plugins/agents/_base/client/agent-client-plugin-context'

const AgentPlugin: React.FC<{ plugin: AgentClientPlugin }> = ({ plugin }) => {
  plugin.usePlugin()
  return null
}

export const AgentPluginProvider: React.FC<React.PropsWithChildren> = ({
  children
}) => {
  const plugins = useMemo(() => createAgentClientPlugins(), [])

  return (
    <AgentClientPluginProvider>
      {plugins.map(plugin => (
        <AgentPlugin key={plugin.id} plugin={plugin} />
      ))}
      {children}
    </AgentClientPluginProvider>
  )
}
