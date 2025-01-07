import type { GetAgent } from '@extension/chat/strategies/base'
import type { CustomRenderThinkItemProps } from '@shared/plugins/agents/_base/client/agent-client-plugin-types'
import type { SFC } from '@shared/types/common'
import { ChatThinkItem } from '@webview/components/chat/messages/roles/chat-thinks'
import { cn } from '@webview/utils/common'

import { WebContentInfoItem } from '../../web-visit-agent-plugin/client/web-visit-agent-think-item'
import type { WebSearchAgent } from '../server/web-search-agent'

export const WebSearchAgentThinkItem: SFC<
  CustomRenderThinkItemProps<GetAgent<WebSearchAgent>>
> = ({ agent }) => (
  <ChatThinkItem title="Search web">
    <div className="mt-2 space-y-1.5">
      {agent.output.searchResults?.map((searchResult, index) => (
        <WebContentInfoItem
          key={index}
          contentInfo={searchResult}
          className={cn(index !== 0 && 'border-t')}
        />
      ))}
    </div>
  </ChatThinkItem>
)
