import type { GetAgent } from '@extension/chat/strategies/base'
import type { CustomRenderThinkItemProps } from '@shared/plugins/agents/_base/client/agent-client-plugin-types'
import type { SFC } from '@shared/types/common'
import { ChatThinkItem } from '@webview/components/chat/messages/roles/chat-thinks'

import { FileSnippetItem } from '../../codebase-search-agent-plugin/client/codebase-search-agent-think-item'
import type { ReadFilesAgent } from '../server/read-files-agent'

export const ReadFilesAgentThinkItem: SFC<
  CustomRenderThinkItemProps<GetAgent<ReadFilesAgent>>
> = ({ agent }) => (
  <ChatThinkItem title="Read Files">
    <div className="mt-2 space-y-1.5">
      {agent.output.codeSnippets.map((snippet, index) => (
        <FileSnippetItem key={index} file={snippet} />
      ))}
    </div>
  </ChatThinkItem>
)
