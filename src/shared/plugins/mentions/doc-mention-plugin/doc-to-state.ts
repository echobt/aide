import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import type { DocRetrieverAgent } from '@shared/plugins/agents/doc-retriever-agent-plugin/server/doc-retriever-agent'

import { BaseToState } from '../_base/base-to-state'
import { DocMentionType, type DocMention } from './types'

export class DocToState extends BaseToState<DocMention> {
  toMentionsState() {
    return {
      allowSearchDocSiteNames: this.getMentionDataByType(DocMentionType.Doc)
    }
  }

  toAgentsState() {
    return {
      relevantDocs: this.getAgentOutputsByKey<
        DocRetrieverAgent,
        'relevantDocs'
      >(AgentPluginId.DocRetriever, 'relevantDocs').flat()
    }
  }
}
