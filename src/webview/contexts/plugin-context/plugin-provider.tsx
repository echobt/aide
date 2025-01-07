import { SessionActionContextProvider } from '../conversation-action-context/session-action-context'
import { AgentPluginProvider } from './agent-plugin-context'
import { MentionPluginProvider } from './mention-plugin-context'

export const PluginProvider: React.FC<React.PropsWithChildren> = ({
  children
}) => (
  <AgentPluginProvider>
    <MentionPluginProvider>
      <SessionActionContextProvider>{children}</SessionActionContextProvider>
    </MentionPluginProvider>
  </AgentPluginProvider>
)

export function WithPluginProvider<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WithPluginProvider(props: P) {
    return (
      <PluginProvider>
        <Component {...props} />
      </PluginProvider>
    )
  }
}
