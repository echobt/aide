import type { AgentServerUtilsProvider } from '@shared/plugins/agents/_base/server/create-agent-provider-manager'

import { DocRetrieverAgent } from './doc-retriever-agent'

export class DocRetrieverAgentServerUtilsProvider
  implements AgentServerUtilsProvider<DocRetrieverAgent>
{
  getAgentClass() {
    return DocRetrieverAgent
  }
}
