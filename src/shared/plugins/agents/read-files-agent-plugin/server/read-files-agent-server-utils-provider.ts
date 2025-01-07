import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'

import { ReadFilesAgent } from './read-files-agent'

export class ReadFilesAgentServerUtilsProvider
  implements AgentServerUtilsProvider<ReadFilesAgent>
{
  getAgentClass() {
    return ReadFilesAgent
  }
}
