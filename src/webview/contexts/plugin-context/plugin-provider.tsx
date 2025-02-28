import { SessionAgentContextProvider } from '../conversation-agent-context/session-agent-context'
import { AgentPluginProvider } from './agent-plugin-context'
import { MentionPluginProvider } from './mention-plugin-context'

export const PluginProvider: React.FC<React.PropsWithChildren> = ({
  children
}) => (
  <AgentPluginProvider>
    <MentionPluginProvider>
      <SessionAgentContextProvider>{children}</SessionAgentContextProvider>
    </MentionPluginProvider>
  </AgentPluginProvider>
)

export const WithPluginProvider = <P extends object>(
  Component: React.ComponentType<P>
) =>
  function WithPluginProvider(props: P) {
    return (
      <PluginProvider>
        <Component {...props} />
      </PluginProvider>
    )
  }
