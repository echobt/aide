import { ChatBubbleIcon, QuoteIcon } from '@radix-ui/react-icons'
import { getAllTextFromConversationContents } from '@shared/utils/chat-context-helper/common/get-all-text-from-conversation-contents'
import { BaseCard } from '@webview/components/ui/base-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@webview/components/ui/tooltip'
import type { PromptSnippetWithSaveType } from '@webview/types/chat'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
        title: t('webview.promptSnippet.deleteTitle'),
        description: t('webview.promptSnippet.deleteConfirmation', {
          title: snippet.title
        }),
        onConfirm: () => onRemove(snippet.id)
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
          <span>
            {t('webview.promptSnippet.messagesInConversation', {
              count: snippet.contents.length
            })}
          </span>
        </div>
      </div>
    </BaseCard>
  )
}
