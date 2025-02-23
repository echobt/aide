import { ChatBubbleIcon, QuoteIcon } from '@radix-ui/react-icons'
import { getAllTextFromConversationContents } from '@shared/utils/chat-context-helper/common/get-all-text-from-conversation-contents'
import { BaseCard } from '@webview/components/ui/base-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@webview/components/ui/tooltip'
import type { PromptSnippetWithSaveType } from '@webview/types/chat'

interface PromptSnippetCardProps {
  snippet: PromptSnippetWithSaveType
  onEdit: (snippet: PromptSnippetWithSaveType) => void
  onRemove: (id: string) => void
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
}

export const PromptSnippetCard = ({
  snippet,
  onEdit,
  onRemove,
  isSelected,
  onSelect
}: PromptSnippetCardProps) => {
  const snippetContent = getAllTextFromConversationContents(snippet.contents)
  const previewContent =
    snippetContent.length > 150
      ? `${snippetContent.slice(0, 150)}...`
      : snippetContent

  return (
    <BaseCard
      title={snippet.title}
      isSelected={isSelected}
      onSelect={onSelect}
      onEdit={() => onEdit(snippet)}
      onDelete={{
        title: 'Delete Prompt Snippet',
        description: `Are you sure you want to delete "${snippet.title}"?`,
        onConfirm: () => onRemove(snippet.id)
      }}
      badge={{
        text: `${snippet.contents.length} messages`,
        variant: 'muted'
      }}
    >
      <div className="mt-2 space-y-2">
        <div className="flex items-start gap-2">
          <QuoteIcon className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-sm text-muted-foreground/90 line-clamp-3">
                {previewContent}
              </div>
            </TooltipTrigger>
            {snippetContent.length > 150 && (
              <TooltipContent className="max-w-sm whitespace-pre-wrap">
                {snippetContent}
              </TooltipContent>
            )}
          </Tooltip>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
          <ChatBubbleIcon className="h-3.5 w-3.5" />
          <span>{snippet.contents.length} messages in conversation</span>
        </div>
      </div>
    </BaseCard>
  )
}
