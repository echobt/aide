import { CodebaseSearchAgentServerPlugin } from '@shared/plugins/agents/codebase-search-agent-plugin/server/codebase-search-agent-server-plugin'
import { EditFileAgentServerPlugin } from '@shared/plugins/agents/edit-file-agent-plugin/server/edit-file-agent-server-plugin'
import { ReadFilesAgentServerPlugin } from '@shared/plugins/agents/read-files-agent-plugin/server/read-files-agent-server-plugin'
import { WebVisitAgentServerPlugin } from '@shared/plugins/agents/web-visit-agent-plugin/server/web-visit-agent-server-plugin'

import { WebSearchAgentServerPlugin } from '../../web-search-agent-plugin/server/web-search-agent-server-plugin'
import type { AgentServerPlugin } from './agent-server-plugin-context'

export const createAgentServerPlugins = (): AgentServerPlugin[] => {
  const plugins: AgentServerPlugin[] = [
    new CodebaseSearchAgentServerPlugin(),
    new ReadFilesAgentServerPlugin(),
    new WebVisitAgentServerPlugin(),
    new WebSearchAgentServerPlugin(),
    new EditFileAgentServerPlugin()
  ]

  return plugins
}
