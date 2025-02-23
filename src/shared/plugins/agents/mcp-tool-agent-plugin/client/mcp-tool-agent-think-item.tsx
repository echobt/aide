import type { FC } from 'react'
import type { Agent } from '@shared/entities'
import type { CustomRenderThinkItemsProps } from '@shared/plugins/agents/_base/client/agent-client-plugin-types'
import type { SFC } from '@shared/types/common'
import { ChatThinkItem } from '@webview/components/chat/messages/roles/chat-thinks'
import type { PreviewContent } from '@webview/components/content-preview'
import { ContentPreviewPopover } from '@webview/components/content-preview-popover'
import { TruncateStart } from '@webview/components/truncate-start'
import { cn } from '@webview/utils/common'
import { HammerIcon } from 'lucide-react'

export const McpToolAgentThinkItem: SFC<CustomRenderThinkItemsProps> = ({
  agents
}) => (
  <ChatThinkItem title="MCP Tools">
    <div className="mt-2 space-y-1.5">
      {agents.map((agent, index) => (
        <McpToolAgentItem
          key={index}
          agent={agent}
          className={cn(index !== 0 && 'border-t')}
        />
      ))}
    </div>
  </ChatThinkItem>
)

interface McpToolAgentItemProps {
  agent: Agent
  className?: string
}

const McpToolAgentItem: FC<McpToolAgentItemProps> = ({ agent, className }) => {
  const previewContent: PreviewContent = {
    type: 'markdown',
    content: `
# ${agent.name}

## input

\`\`\`json
${JSON.stringify(agent.input, null, 2)}
\`\`\`

## output

\`\`\`json
${JSON.stringify(agent.output, null, 2)}
\`\`\`
`
  }

  return (
    <ContentPreviewPopover content={previewContent}>
      <div
        className={cn(
          'w-full cursor-pointer rounded-md text-sm flex items-center gap-2 hover:bg-border select-none',
          className
        )}
      >
        <div className="flex shrink-0 items-center gap-2">
          <HammerIcon className="shrink-0 size-4 text-foreground/70" />
          <span>{agent.name}</span>
        </div>
        <TruncateStart className="text-muted-foreground">
          {JSON.stringify(agent.input, null, 0).slice(0, 100)}
        </TruncateStart>
      </div>
    </ContentPreviewPopover>
  )
}
