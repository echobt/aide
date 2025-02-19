import { useEffect, useMemo, useRef } from 'react'
import type { WebPreviewProjectFile } from '@shared/entities'
import { removeDuplicates } from '@shared/utils/common'
import { TreeItem } from '@webview/components/tree'
import { useCallbackRef } from '@webview/hooks/use-callback-ref'

import { useCodeExplorerContext } from '../context/code-explorer-context'

interface UseCodeExplorerTreeProps {
  files: WebPreviewProjectFile[]
  activeFile?: WebPreviewProjectFile | null
}

interface UseCodeExplorerTreeResult {
  treeItems: TreeItem[]
  expandedItemIds: string[]
  handleExpand: (newExpandedIds: string[]) => void
}

export const useCodeExplorerTree = ({
  files,
  activeFile
}: UseCodeExplorerTreeProps): UseCodeExplorerTreeResult => {
  const { expandedItemIds, setExpandedItemIds } = useCodeExplorerContext()
  const initializedRef = useRef(false)

  // Convert files to tree items
  const treeItems = useMemo(() => {
    const items: TreeItem[] = []

    // Helper function to add path segments to tree
    const addPathToTree = (path: string) => {
      const segments = path.split('/')
      let currentLevel = items
      let currentPath = ''

      segments.forEach((segment, index) => {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment
        const isFile = index === segments.length - 1

        let existingItem = currentLevel.find(item => item.name === segment)

        if (!existingItem) {
          existingItem = {
            id: currentPath,
            name: segment,
            isLeaf: isFile,
            children: isFile ? undefined : []
          }
          currentLevel.push(existingItem)
        }

        if (!isFile) {
          currentLevel = existingItem.children!
        }
      })
    }

    // Process all files
    files.forEach(file => {
      addPathToTree(file.path)
    })

    // Sort items - folders first, then files, both alphabetically
    const sortItems = (items: TreeItem[]) => {
      items.sort((a, b) => {
        if (a.children && !b.children) return -1
        if (!a.children && b.children) return 1
        return a.name.localeCompare(b.name)
      })

      items.forEach(item => {
        if (item.children) {
          sortItems(item.children)
        }
      })
    }

    sortItems(items)
    return items
  }, [files])

  const handleExpand = (newExpandedIds: string[]) => {
    setExpandedItemIds(removeDuplicates(newExpandedIds))
  }

  // Initial auto expand all
  useEffect(() => {
    if (initializedRef.current) return

    const newAutoExpandedIds = new Set<string>()
    const expandAllNodes = (items: TreeItem[]) => {
      items.forEach(item => {
        newAutoExpandedIds.add(item.id)
        if (item.children) {
          expandAllNodes(item.children)
        }
      })
    }

    expandAllNodes(treeItems)
    setExpandedItemIds(Array.from(newAutoExpandedIds))
    initializedRef.current = true
  }, [treeItems])

  const getExpandedItemIds = useCallbackRef(() => expandedItemIds)

  // Auto expand to active file
  useEffect(() => {
    if (!activeFile || !initializedRef.current) return

    const newAutoExpandedIds = new Set(getExpandedItemIds())
    const expandToActiveFile = (items: TreeItem[]) => {
      items.forEach(item => {
        if (activeFile.path.startsWith(item.id)) {
          newAutoExpandedIds.add(item.id)
          getAllParentIds(treeItems, item.id).forEach(id =>
            newAutoExpandedIds.add(id)
          )
          if (item.children) {
            expandToActiveFile(item.children)
          }
        }
      })
    }

    expandToActiveFile(treeItems)
    setExpandedItemIds(Array.from(newAutoExpandedIds))
  }, [activeFile, treeItems])

  return {
    treeItems,
    expandedItemIds,
    handleExpand
  }
}

const getAllParentIds = (
  items: TreeItem[],
  targetId: string,
  path: string[] = []
): string[] => {
  for (const item of items) {
    const currentPath = [...path, item.id]
    if (item.id === targetId) return path
    if (item.children) {
      const result = getAllParentIds(item.children, targetId, currentPath)
      if (result.length > 0) return result
    }
  }
  return []
}
