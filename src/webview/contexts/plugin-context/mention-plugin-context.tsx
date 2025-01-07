import React, { useMemo } from 'react'
import type { MentionClientPlugin } from '@shared/plugins/mentions/_base/client/create-mention-client-plugin'
import { MentionClientPluginProvider } from '@shared/plugins/mentions/_base/client/mention-client-plugin-context'
import { createMentionClientPlugins } from '@shared/plugins/mentions/_base/client/mention-client-plugins'

export { useMentionPlugin } from '@shared/plugins/mentions/_base/client/mention-client-plugin-context'

const MentionPlugin: React.FC<{ plugin: MentionClientPlugin }> = ({
  plugin
}) => {
  plugin.usePlugin()
  return null
}

export const MentionPluginProvider: React.FC<React.PropsWithChildren> = ({
  children
}) => {
  const plugins = useMemo(() => createMentionClientPlugins(), [])

  return (
    <MentionClientPluginProvider>
      {plugins.map(plugin => (
        <MentionPlugin key={plugin.id} plugin={plugin} />
      ))}
      {children}
    </MentionClientPluginProvider>
  )
}
