import { useState } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { MagnifyingGlassIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { AlertAction } from '@webview/components/ui/alert-action'
import { Input } from '@webview/components/ui/input'
import { useTranslation } from 'react-i18next'

import { ScrollArea } from '../scroll-area'
import { SortableItem } from './sortable-item'

export interface SidebarListRenderItemProps<T> {
  item: T
  dragHandleProps?: any
  onSelect: (selected: boolean) => void
  isSelected: boolean
  isDragging?: boolean
}

export interface SidebarListProps<T> {
  // Basic props
  items: T[]
  idField: keyof T
  title?: string
  itemName?: string

  // Features control
  draggable?: boolean
  selectable?: boolean
  searchable?: boolean
  searchPlaceholder?: string

  // Actions
  onSearch?: (query: string) => void
  onCreateItem?: () => void
  onDeleteItems?: (items: T[]) => void
  onReorderItems?: (items: T[]) => void

  // Render functions
  renderItem: (props: SidebarListRenderItemProps<T>) => React.ReactNode

  // Optional actions in header
  headerLeftActions?: React.ReactNode
  headerRightActions?: React.ReactNode

  // Add emptyContent prop
  emptyContent?: React.ReactNode
}

export function SidebarList<T>({
  items,
  idField,
  title,
  itemName = 'item',
  draggable = false,
  selectable = true,
  searchable = true,
  searchPlaceholder = 'Search...',
  onSearch,
  onCreateItem,
  onDeleteItems,
  onReorderItems,
  renderItem,
  headerLeftActions,
  headerRightActions,
  emptyContent
}: SidebarListProps<T>) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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

  // Handle search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    onSearch?.(query)
  }

  // Add default empty state component
  const renderDefaultEmptyContent = () => (
    <div className="flex flex-col items-center justify-center m-4 p-8 text-center border-1 border-dashed rounded-lg">
      <h3 className="text-lg font-medium">
        {t('webview.sidebarList.noItems', { itemName })}
      </h3>
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="space-y-1 shrink-0 px-4 pt-4">
        {title && (
          <h2 className="text-2xl mb-4 font-semibold tracking-tight">
            {title}
          </h2>
        )}

        <div className="flex flex-col justify-center gap-2">
          {headerLeftActions}

          <div className="flex-1">
            {searchable && (
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {headerRightActions}

            {selectable && (
              <div className="flex items-center gap-2">
                <ButtonWithTooltip
                  variant="ghost"
                  size="sm"
                  className="flex justify-between px-1 gap-2"
                  tooltip={t('webview.sidebarList.selectedItemsCount', {
                    count: selectedIds.size,
                    itemName
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
                size="sm"
                onClick={() => onCreateItem()}
                tooltip={t('webview.sidebarList.createNewItem', { itemName })}
                className="flex-1 gap-2"
              >
                <PlusIcon className="size-4" /> {t('webview.sidebarList.new')}{' '}
                {itemName}
              </ButtonWithTooltip>
            )}

            {selectedIds.size > 0 && onDeleteItems && (
              <AlertAction
                title={t('webview.sidebarList.deleteItems')}
                description={t('webview.sidebarList.deleteConfirmation', {
                  count: selectedIds.size
                })}
                variant="destructive"
                confirmText={t('webview.sidebarList.delete')}
                onConfirm={handleDeleteSelected}
                disabled={selectedIds.size === 0}
              >
                <ButtonWithTooltip
                  size="sm"
                  tooltip={t('webview.sidebarList.deleteSelectedItems', {
                    count: selectedIds.size,
                    itemName
                  })}
                  disabled={selectedIds.size === 0}
                  className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                >
                  <TrashIcon className="size-4" />{' '}
                  {t('webview.sidebarList.delete')} ({selectedIds.size})
                </ButtonWithTooltip>
              </AlertAction>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      {items.length === 0 ? (
        emptyContent || renderDefaultEmptyContent()
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={draggable ? handleDragStart : undefined}
          onDragEnd={draggable ? handleDragEnd : undefined}
        >
          <SortableContext
            items={items.map(item => String(item[idField]))}
            strategy={verticalListSortingStrategy}
          >
            <ScrollArea
              className="mt-2 flex-1"
              viewPortProps={{
                className: '[&>div]:!block'
              }}
            >
              <div className="space-y-1 py-2 px-3">
                {items.map(item => {
                  const id = String(item[idField])
                  return (
                    <SortableItem key={id} id={id} draggable={draggable}>
                      {dragHandleProps =>
                        renderItem({
                          item,
                          isSelected: selectedIds.has(id),
                          onSelect: selected => handleSelectItem(id, selected),
                          dragHandleProps,
                          isDragging: id === draggingId
                        })
                      }
                    </SortableItem>
                  )
                })}
              </div>
            </ScrollArea>
          </SortableContext>

          {draggable && (
            <DragOverlay>
              {draggingId
                ? renderItem({
                    item: items.find(
                      item => String(item[idField]) === draggingId
                    ) as T,
                    isSelected: selectedIds.has(draggingId),
                    onSelect: () => {},
                    isDragging: true
                  })
                : null}
            </DragOverlay>
          )}
        </DndContext>
      )}
    </div>
  )
}
