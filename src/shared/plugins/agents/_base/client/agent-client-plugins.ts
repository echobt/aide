import { CodebaseSearchAgentClientPlugin } from '@shared/plugins/agents/codebase-search-agent-plugin/client/codebase-search-agent-client-plugin'
import { EditFileAgentClientPlugin } from '@shared/plugins/agents/edit-file-agent-plugin/client/edit-file-agent-client-plugin'
import { ReadFilesAgentClientPlugin } from '@shared/plugins/agents/read-files-agent-plugin/client/read-files-agent-client-plugin'
import { WebVisitAgentClientPlugin } from '@shared/plugins/agents/web-visit-agent-plugin/client/web-visit-agent-client-plugin'

import { WebPreviewAgentClientPlugin } from '../../web-preview-agent-plugin/client/web-preview-agent-client-plugin'
import { WebSearchAgentClientPlugin } from '../../web-search-agent-plugin/client/web-search-agent-client-plugin'
import type { AgentClientPlugin } from './create-agent-client-plugin'

export const createAgentClientPlugins = (): AgentClientPlugin[] => {
  const plugins: AgentClientPlugin[] = [
    CodebaseSearchAgentClientPlugin,
    ReadFilesAgentClientPlugin,
    WebVisitAgentClientPlugin,
    WebSearchAgentClientPlugin,
    EditFileAgentClientPlugin,
    WebPreviewAgentClientPlugin
  ]

  return plugins
}
