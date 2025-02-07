import type { FC } from 'react'
import type { GetAgent } from '@shared/plugins/_shared/strategies'
import type { CustomRenderThinkItemProps } from '@shared/plugins/agents/_base/client/agent-client-plugin-types'
import type { SFC } from '@shared/types/common'
import { ChatThinkItem } from '@webview/components/chat/messages/roles/chat-thinks'
import type { PreviewContent } from '@webview/components/content-preview'
import { ContentPreviewPopover } from '@webview/components/content-preview-popover'
import { api } from '@webview/network/actions-api'
import { cn } from '@webview/utils/common'
import { FileTextIcon } from 'lucide-react'

import type { DocRetrieverAgent } from '../server/doc-retriever-agent'
import type { DocInfo } from '../types'

export const DocRetrieverAgentThinkItem: SFC<
  CustomRenderThinkItemProps<GetAgent<DocRetrieverAgent>>
> = ({ agent }) => (
  <ChatThinkItem title="Search documentation">
    <div className="mt-2 space-y-1.5">
      {agent.output.relevantDocs?.map((doc, index) => (
        <DocItem
          key={index}
          doc={doc}
          className={cn(index !== 0 && 'border-t')}
        />
      ))}
    </div>
  </ChatThinkItem>
)

interface DocItemProps {
  doc: DocInfo
  className?: string
}

export const DocItem: FC<DocItemProps> = ({ doc, className }) => {
  const previewContent: PreviewContent = {
    type: 'markdown',
    content: doc.content
  }

  const handleOpenPath = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!doc.path) return

    // if path is a url, open it in the browser
    if (doc.path.startsWith('http')) {
      window.open(doc.path, '_blank')
    } else {
      // if path is a local file, open it in the editor
      await api.actions().server.file.openFileInEditor({
        actionParams: {
          schemeUri: doc.path
        }
      })
    }
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
        <div className="shrink-0">
          <div className="flex size-8 items-center justify-center rounded-md border">
            <FileTextIcon className="size-4 text-foreground/70" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Content Preview */}
          <div className="mb-1 line-clamp-1 text-sm text-foreground">
            {doc.content}
          </div>

          {/* Path */}
          <div
            onClick={handleOpenPath}
            className="truncate text-xs font-medium text-foreground/70 hover:text-primary cursor-pointer"
          >
            {doc.path}
          </div>
        </div>
      </div>
    </ContentPreviewPopover>
  )
}
