import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'

import { WebVisitAgent } from './web-visit-agent'

export class WebVisitAgentServerUtilsProvider
  implements AgentServerUtilsProvider<WebVisitAgent>
{
  getAgentClass() {
    return WebVisitAgent
  }
}
