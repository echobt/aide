import React, { useEffect, useRef } from 'react'
import { ScrollArea } from '@webview/components/ui/scroll-area'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'
import { useControllableState } from '@webview/hooks/use-controllable-state'
import { cn } from '@webview/utils/common'

export interface TreeItem {
  id: string
  name: string
  children?: TreeItem[]
  isLeaf?: boolean
  [key: string]: any
}

export interface TreeNodeRenderProps {
  item: TreeItem
  isSelected: boolean
  isIndeterminate: boolean
  isExpanded: boolean
  hasChildren: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  level: number
}

interface TreeProps {
  items: TreeItem[]
  selectedItemIds?: string[]
  expandedItemIds?: string[]
  onSelect?: (selectedIds: string[]) => void
  onExpand?: (expandedIds: string[]) => void
  className?: string
  renderItem?: (props: TreeNodeRenderProps) => React.ReactNode
}

export const Tree: React.FC<TreeProps> = ({
  items,
  selectedItemIds = [],
  expandedItemIds = [],
  onSelect,
  onExpand,
  className,
  renderItem
}) => {
  const [selected, setSelected] = useControllableState({
    prop: selectedItemIds,
    defaultProp: [],
    onChange: newSelected => onSelect?.(newSelected)
  })

  const [expanded, setExpanded] = useControllableState({
    prop: expandedItemIds,
    defaultProp: [],
    onChange: newExpanded => onExpand?.(newExpanded)
  })

  const getSelected = useCallbackRef(() => selected)
  const getExpanded = useCallbackRef(() => expanded)

  const getLeafIds = (item: TreeItem): string[] => {
    if (item.isLeaf) {
      return [item.id]
    }
    return (item.children || []).flatMap(getLeafIds)
  }

  const isItemSelected = (item: TreeItem): boolean => {
    const selected = getSelected()
    if (item.isLeaf) {
      return selected?.includes(item.id) ?? false
    }
    const leafIds = getLeafIds(item)
    return leafIds.every(id => selected?.includes(id))
  }

  const isItemIndeterminate = (item: TreeItem): boolean => {
    const selected = getSelected()
    if (item.isLeaf) {
      return false
    }
    const leafIds = getLeafIds(item)
    const selectedLeafs = leafIds.filter(id => selected?.includes(id))
    return selectedLeafs.length > 0 && selectedLeafs.length < leafIds.length
  }

  const handleSelect = (item: TreeItem) => {
    const selected = getSelected()
    const newSelected = [...(selected || [])]
    const leafIds = getLeafIds(item)

    if (isItemSelected(item)) {
      leafIds.forEach(id => newSelected.splice(newSelected.indexOf(id), 1))
    } else {
      leafIds.forEach(id => newSelected.push(id))
    }

    setSelected(newSelected)
  }

  const handleExpand = (itemId: string) => {
    const expanded = getExpanded()
    const newExpanded = [...(expanded || [])]
    if (newExpanded.includes(itemId)) {
      newExpanded.splice(newExpanded.indexOf(itemId), 1)
    } else {
      newExpanded.push(itemId)
    }
    setExpanded(newExpanded)
  }

  const renderTreeItems = (treeItems: TreeItem[], level = 0) =>
    treeItems.map(item => (
      <TreeNode
        key={item.id}
        item={item}
        isSelected={isItemSelected(item)}
        isIndeterminate={isItemIndeterminate(item)}
        isExpanded={expanded?.includes(item.id) ?? false}
        onToggleSelect={() => handleSelect(item)}
        onToggleExpand={() => handleExpand(item.id)}
        renderItem={renderItem}
        level={level}
      >
        {item.children &&
          expanded?.includes(item.id) &&
          renderTreeItems(item.children, level + 1)}
      </TreeNode>
    ))

  return (
    <ScrollArea className={cn('h-full w-full', className)}>
      <div className="p-2">{renderTreeItems(items)}</div>
    </ScrollArea>
  )
}

interface TreeNodeProps {
  item: TreeItem
  isSelected: boolean
  isIndeterminate: boolean
  isExpanded: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  children?: React.ReactNode
  renderItem?: (props: TreeNodeRenderProps) => React.ReactNode
  level: number
}

const TreeNode: React.FC<TreeNodeProps> = ({
  item,
  isSelected,
  isIndeterminate,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  children,
  renderItem,
  level
}) => {
  const hasChildren = !!(item.children && item.children.length)
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isIndeterminate
    }
  }, [isIndeterminate])

  const renderProps: TreeNodeRenderProps = {
    item,
    isSelected,
    isIndeterminate,
    isExpanded,
    hasChildren,
    onToggleSelect,
    onToggleExpand,
    level
  }

  const content = renderItem ? (
    renderItem(renderProps)
  ) : (
    <div
      className={cn('flex items-center py-1 cursor-pointer')}
      style={{ marginLeft: `${level * 20}px` }}
    >
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="mx-1 w-4 h-4"
      />
      <span onClick={onToggleExpand}>{item.name}</span>
    </div>
  )

  return (
    <div>
      {content}
      {hasChildren && isExpanded && children}
    </div>
  )
}
