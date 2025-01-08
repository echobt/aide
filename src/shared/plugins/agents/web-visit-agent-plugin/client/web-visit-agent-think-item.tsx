import type { GetAgent } from '@extension/chat/strategies/_base'
import type { CustomRenderThinkItemProps } from '@shared/plugins/agents/_base/client/agent-client-plugin-types'
import type { SFC } from '@shared/types/common'
import { ChatThinkItem } from '@webview/components/chat/messages/roles/chat-thinks'
import { ContentPreviewPopover } from '@webview/components/content-preview-popover'
import { cn } from '@webview/utils/common'
import { GlobeIcon } from 'lucide-react'

import type { WebVisitAgent } from '../server/web-visit-agent'
import type { WebContentInfo } from '../types'

export const WebVisitAgentThinkItem: SFC<
  CustomRenderThinkItemProps<GetAgent<WebVisitAgent>>
> = ({ agent }) => (
  <ChatThinkItem title="Visit web">
    <div className="mt-2 space-y-1.5">
      {agent.output.visitResults?.map((visitResult, index) => (
        <WebContentInfoItem
          key={index}
          contentInfo={visitResult}
          className={cn(index !== 0 && 'border-t')}
        />
      ))}
    </div>
  </ChatThinkItem>
)

interface WebContentInfoItemProps {
  contentInfo: WebContentInfo
  className?: string
}

export const WebContentInfoItem: React.FC<WebContentInfoItemProps> = ({
  contentInfo,
  className
}) => {
  const previewContent = {
    type: 'markdown' as const,
    content: contentInfo.content
  }

  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!contentInfo.url) return
    window.open(contentInfo.url, '_blank')
  }

  return (
    <ContentPreviewPopover content={previewContent}>
      <div
        className={cn(
          'group flex items-center gap-2 p-2 rounded-md',
          'hover:bg-accent cursor-pointer transition-all duration-200',
          className
        )}
      >
        <div className="flex-shrink-0">
          <div className="flex size-8 items-center justify-center rounded-md border">
            <GlobeIcon className="size-4 text-foreground/70" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Content Preview */}
          <div className="mb-1 line-clamp-1 text-sm text-foreground">
            {contentInfo.content}
          </div>

          {/* URL */}
          <div
            onClick={handleOpenUrl}
            className="truncate text-xs font-medium text-foreground/70 hover:text-primary cursor-pointer"
          >
            {contentInfo.url}
          </div>
        </div>
      </div>
    </ContentPreviewPopover>
  )
}
