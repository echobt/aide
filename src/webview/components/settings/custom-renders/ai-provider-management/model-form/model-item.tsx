import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import {
  DragHandleDots2Icon,
  MinusIcon,
  PlusIcon,
  TrashIcon
} from '@radix-ui/react-icons'
import type { AIModel } from '@shared/entities'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { Checkbox } from '@webview/components/ui/checkbox'
import { useTranslation } from 'react-i18next'

interface ModelItemProps {
  model: AIModel
  dragHandleProps?: SyntheticListenerMap
  isRemote?: boolean
  isSelected?: boolean
  isAdded?: boolean
  onSelect?: (selected: boolean) => void
  onDelete?: (model: AIModel) => void
  onAddToManual?: (model: AIModel) => void
  onRemoveFromManual?: (model: AIModel) => void
}

export const ModelItem = ({
  model,
  dragHandleProps,
  isRemote = false,
  isSelected = false,
  isAdded = false,
  onSelect,
  onDelete,
  onAddToManual,
  onRemoveFromManual
}: ModelItemProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2 w-full cursor-pointer">
      {onSelect && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          onClick={e => e.stopPropagation()} // Prevent accordion from toggling
        />
      )}
      {!isRemote && dragHandleProps && (
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing"
        >
          <DragHandleDots2Icon className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 text-foreground/80">{model.name}</div>
      <div className="flex gap-2">
        {!isRemote && onDelete && (
          <ButtonWithTooltip
            variant="ghost"
            size="sm"
            tooltip={t('webview.common.delete')}
            className="h-7 w-7 p-0 hover:bg-muted text-destructive hover:text-destructive"
            onClick={e => {
              e.stopPropagation()
              onDelete(model)
            }}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </ButtonWithTooltip>
        )}
        {isRemote && isAdded ? (
          <ButtonWithTooltip
            variant="ghost"
            size="sm"
            tooltip={t('webview.aiProvider.removeFromManual')}
            className="h-7 w-7 p-0 hover:bg-muted text-destructive hover:text-destructive"
            onClick={e => {
              e.stopPropagation()
              onRemoveFromManual?.(model)
            }}
          >
            <MinusIcon className="h-3.5 w-3.5" />
          </ButtonWithTooltip>
        ) : (
          <ButtonWithTooltip
            variant="ghost"
            size="sm"
            tooltip={t('webview.aiProvider.addToManual')}
            className="h-7 w-7 p-0 hover:bg-muted"
            onClick={e => {
              e.stopPropagation()
              onAddToManual?.(model)
            }}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </ButtonWithTooltip>
        )}
      </div>
    </div>
  )
}
