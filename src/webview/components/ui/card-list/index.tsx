import { useState } from 'react'
import {
  closestCenter,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
  type MeasuringConfiguration
} from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable'
import { PlusIcon, TrashIcon } from '@radix-ui/react-icons'
import { Slottable } from '@radix-ui/react-slot'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@webview/components/ui/accordion'
import { AlertAction } from '@webview/components/ui/alert-action'
import { Button } from '@webview/components/ui/button'
import { cn } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'

import { SortableCard } from './sortable-card'

export interface CardListProps<T> {
  // Basic props
  className?: string
  items: T[]
  idField: keyof T
  title?: string

  // Features control
  draggable?: boolean
  showDragOverlay?: boolean
  selectable?: boolean
  expandable?: boolean

  // Expansion control
  defaultExpandedIds?: string[]
  onExpandedChange?: (ids: string[]) => void

  // Actions
  onCreateItem?: () => void
  onDeleteItems?: (items: T[]) => void
  onReorderItems?: (items: T[]) => void

  // Render functions
  renderCard: (props: {
    item: T
    isSelected: boolean
    onSelect: (selected: boolean) => void
    dragHandleProps?: SyntheticListenerMap
    isExpanded?: boolean
  }) => React.ReactNode
  renderExpandedContent?: (item: T) => React.ReactNode

  // Optional actions in header
  headerLeftActions?: React.ReactNode
  headerRightActions?: React.ReactNode

  // Add minCardWidth prop with default value
  minCardWidth?: number

  // Add emptyContent prop
  emptyContent?: React.ReactNode
}

export function CardList<T>({
  className,
  items,
  idField,
  title,
  draggable = true,
  showDragOverlay = true,
  selectable = true,
  expandable = false,
  minCardWidth = 300,
  defaultExpandedIds = [],
  onExpandedChange,
  onCreateItem,
  onDeleteItems,
  onReorderItems,
  renderCard,
  renderExpandedContent,
  headerLeftActions,
  headerRightActions,
  emptyContent
}: CardListProps<T>) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(defaultExpandedIds)
  )

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(items.map(item => String(item[idField]))))
    } else {
      setSelectedIds(new Set())
    }
  }

  const getSelectAllState = () => {
    const selectedCount = selectedIds.size
    const totalCount = items.length
    return {
      checked: selectedCount > 0,
      indeterminate: selectedCount > 0 && selectedCount < totalCount
    }
  }

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  // DnD sensors setup
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    setDraggingId(id)
    setExpandedIds(new Set())
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(
        item => String(item[idField]) === String(active.id)
      )
      const newIndex = items.findIndex(
        item => String(item[idField]) === String(over.id)
      )

      const newItems = arrayMove(items, oldIndex, newIndex)
      onReorderItems?.(newItems)
    }

    setDraggingId(null)
  }

  // Delete selected items
  const handleDeleteSelected = () => {
    const selectedItems = items.filter(item =>
      selectedIds.has(String(item[idField]))
    )
    onDeleteItems?.(selectedItems)
    setSelectedIds(new Set())
  }

  const handleExpandedChange = (id: string, expanded: boolean) => {
    const newExpandedIds = new Set(expandedIds)
    if (expanded) {
      newExpandedIds.add(id)
    } else {
      newExpandedIds.delete(id)
    }
    setExpandedIds(newExpandedIds)
    onExpandedChange?.(Array.from(newExpandedIds))
  }

  const renderCardWithExpansion = (
    item: T,
    isSelected: boolean,
    dragHandleProps?: SyntheticListenerMap
  ) => {
    const id = String(item[idField])
    const isExpanded = expandedIds.has(id)

    if (!expandable) {
      return renderCard({
        item,
        isSelected,
        onSelect: selected => handleSelectItem(id, selected),
        dragHandleProps,
        isExpanded
      })
    }

    return (
      <div className="border rounded-md p-2">
        <Accordion type="single" collapsible value={isExpanded ? id : ''}>
          <AccordionItem value={id} className="border-b-0">
            <AccordionTrigger
              className="hover:no-underline p-0"
              asChild
              onClick={() => handleExpandedChange(id, !isExpanded)}
            >
              <Slottable>
                <div>
                  {renderCard({
                    item,
                    isSelected,
                    onSelect: selected => handleSelectItem(id, selected),
                    dragHandleProps,
                    isExpanded
                  })}
                </div>
              </Slottable>
            </AccordionTrigger>
            {renderExpandedContent && (
              <AccordionContent>{renderExpandedContent(item)}</AccordionContent>
            )}
          </AccordionItem>
        </Accordion>
      </div>
    )
  }

  const measuring: MeasuringConfiguration = {
    droppable: {
      strategy: MeasuringStrategy.Always
    }
  }

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5'
        }
      }
    })
  }

  // Add default empty state component
  const renderDefaultEmptyContent = () => (
    <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/50">
      <div className="space-y-3">
        <h3 className="text-lg font-medium">
          {t('webview.cardList.noItemsYet')}
        </h3>
        {onCreateItem && (
          <Button onClick={onCreateItem} size="sm">
            <PlusIcon className="size-4 mr-2" />
            {t('webview.cardList.createItem')}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {title && <h2 className="font-medium">{title}</h2>}
          {headerLeftActions}
        </div>

        <div className="flex items-center gap-2">
          {headerRightActions}

          {selectable && (
            <div className="flex items-center gap-2">
              <ButtonWithTooltip
                variant="ghost"
                size="xs"
                className="flex justify-between px-1 gap-2"
                tooltip={t('webview.cardList.selectedItemsCount', {
                  count: selectedIds.size
                })}
                onClick={() => {
                  const { checked } = getSelectAllState()
                  handleSelectAll(!checked)
                }}
              >
                <input
                  type="checkbox"
                  ref={ref => {
                    if (ref) {
                      const { checked, indeterminate } = getSelectAllState()
                      ref.checked = checked
                      ref.indeterminate = indeterminate
                    }
                  }}
                  data-state={
                    getSelectAllState().checked ? 'checked' : 'unchecked'
                  }
                  className="custom-checkbox !border-foreground opacity-50 data-[state=checked]:opacity-100 data-[state=checked]:!border-primary"
                />
                {/* <span className="text-sm">{selectedIds.size}</span> */}
              </ButtonWithTooltip>
            </div>
          )}

          {selectedIds.size === 0 && onCreateItem && (
            <ButtonWithTooltip
              size="xs"
              onClick={onCreateItem}
              tooltip={t('webview.cardList.createNewItem')}
              className="gap-2"
            >
              <PlusIcon className="size-3" /> {t('webview.cardList.new')}
            </ButtonWithTooltip>
          )}

          {selectedIds.size > 0 && onDeleteItems && (
            <AlertAction
              title={t('webview.cardList.deleteItems')}
              description={t('webview.cardList.deleteConfirmation', {
                count: selectedIds.size
              })}
              variant="destructive"
              confirmText={t('webview.cardList.delete')}
              onConfirm={handleDeleteSelected}
              disabled={selectedIds.size === 0}
            >
              <ButtonWithTooltip
                size="xs"
                tooltip={t('webview.cardList.deleteSelectedItems')}
                disabled={selectedIds.size === 0}
                className="text-destructive-foreground bg-destructive hover:bg-destructive/80 gap-2"
              >
                <TrashIcon className="size-3" /> {t('webview.cardList.delete')}{' '}
                ({selectedIds.size})
              </ButtonWithTooltip>
            </AlertAction>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        emptyContent || renderDefaultEmptyContent()
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={draggable ? handleDragStart : undefined}
          onDragEnd={draggable ? handleDragEnd : undefined}
          measuring={measuring}
        >
          <SortableContext
            items={items.map(item => String(item[idField]))}
            strategy={rectSortingStrategy}
          >
            <div
              className="grid gap-2 auto-rows-fr"
              style={{
                gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minCardWidth}px), 1fr))`
              }}
            >
              {items.map(item => {
                const id = String(item[idField])
                return (
                  <SortableCard key={id} id={id} draggable={draggable}>
                    {dragHandleProps =>
                      renderCardWithExpansion(
                        item,
                        selectedIds.has(id),
                        dragHandleProps
                      )
                    }
                  </SortableCard>
                )
              })}
            </div>
          </SortableContext>

          {draggable && showDragOverlay && (
            <DragOverlay dropAnimation={dropAnimation}>
              {draggingId
                ? renderCardWithExpansion(
                    items.find(
                      item => String(item[idField]) === draggingId
                    ) as T,
                    selectedIds.has(draggingId),
                    undefined
                  )
                : null}
            </DragOverlay>
          )}
        </DndContext>
      )}
    </div>
  )
}
