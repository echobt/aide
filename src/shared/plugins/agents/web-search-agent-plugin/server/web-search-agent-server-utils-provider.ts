import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'

import { WebSearchAgent } from './web-search-agent'

export class WebSearchAgentServerUtilsProvider
  implements AgentServerUtilsProvider<WebSearchAgent>
{
  getAgentClass() {
    return WebSearchAgent
  }
}
