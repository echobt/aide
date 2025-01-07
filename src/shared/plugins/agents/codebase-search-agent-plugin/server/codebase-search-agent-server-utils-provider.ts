import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'

import { CodebaseSearchAgent } from './codebase-search-agent'

export class CodebaseSearchAgentServerUtilsProvider
  implements AgentServerUtilsProvider<CodebaseSearchAgent>
{
  getAgentClass() {
    return CodebaseSearchAgent
  }
}
