import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { WebSearchAgent } from '@shared/plugins/agents/web-search-agent-plugin/server/web-search-agent'
import type { WebVisitAgent } from '@shared/plugins/agents/web-visit-agent-plugin/server/web-visit-agent'

import { BaseToState } from '../_base/base-to-state'
import { WebMentionType, type WebMention } from './types'

export class WebToState extends BaseToState<WebMention> {
  toMentionsState() {
    return {
      enableWebSearchAgent: this.isMentionExit(WebMentionType.Web),
      enableWebVisitAgent: this.isMentionExit(WebMentionType.Web)
    }
  }

  toAgentsState() {
    return {
      webSearchRelevantContent: this.getAgentOutputsByKey<
        WebSearchAgent,
        'relevantContent'
      >(AgentPluginId.WebSearch, 'relevantContent').flat(),
      webVisitContents: this.getAgentOutputsByKey<
        WebVisitAgent,
        'visitResults'
      >(AgentPluginId.WebVisit, 'visitResults').flat()
    }
  }
}
