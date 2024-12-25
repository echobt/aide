import type { PromptSnippetWithSaveType } from '@extension/actions/prompt-snippet-actions'
import { Pencil2Icon, TrashIcon } from '@radix-ui/react-icons'
import { getAllTextFromLangchainMessageContents } from '@shared/utils/get-all-text-from-langchain-message-contents'
import { AlertAction } from '@webview/components/ui/alert-action'
import { Button } from '@webview/components/ui/button'
import { Checkbox } from '@webview/components/ui/checkbox'

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
}: PromptSnippetCardProps) => (
  <div className="border rounded-lg p-4 shadow-sm bg-card hover:shadow-md transition-shadow space-y-4">
    <div className="flex justify-between items-start">
      <div className="flex items-center gap-2">
        {onSelect && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="translate-y-[1px]"
          />
        )}
        <h3 className="font-medium text-foreground text-base">
          {snippet.title}
        </h3>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => onEdit(snippet)}
          size="sm"
          className="h-7 w-7 p-0 hover:bg-muted"
        >
          <Pencil2Icon className="h-3.5 w-3.5" />
        </Button>
        <AlertAction
          title="Delete Prompt Snippet"
          description={`Are you sure you want to delete "${snippet.title}"?`}
          variant="destructive"
          confirmText="Delete"
          onConfirm={() => onRemove(snippet.id)}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-muted text-destructive hover:text-destructive"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </Button>
        </AlertAction>
      </div>
    </div>

    <div className="text-xs text-muted-foreground line-clamp-3">
      {getAllTextFromLangchainMessageContents(snippet.contents)}
    </div>
  </div>
)
