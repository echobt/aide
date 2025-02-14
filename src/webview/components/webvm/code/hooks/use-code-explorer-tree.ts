import { useEffect, useMemo, useRef } from 'react'
import type { WebPreviewProjectFile } from '@shared/entities'
import { removeDuplicates } from '@shared/utils/common'
import { TreeItem } from '@webview/components/tree'

import { useCodeExplorerContext } from '../context/code-explorer-context'

interface UseCodeExplorerTreeProps {
  files: WebPreviewProjectFile[]
  activeFile?: WebPreviewProjectFile | null
}

interface UseCodeExplorerTreeResult {
  treeItems: TreeItem[]
  expandedItemIds: string[]
  handleExpand: (newExpandedIds: string[]) => void
  getAllParentIds: (
    items: TreeItem[],
    targetId: string,
    path?: string[]
  ) => string[]
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

  const handleExpand = (newExpandedIds: string[]) => {
    setExpandedItemIds(removeDuplicates(newExpandedIds))
  }

  // Auto expand logic for initial render
  useEffect(() => {
    if (initializedRef.current) return

    const newAutoExpandedIds = new Set<string>()
    const expandInitialNodes = (items: TreeItem[]) => {
      items.forEach(item => {
        newAutoExpandedIds.add(item.id)
        getAllParentIds(treeItems, item.id).forEach(id =>
          newAutoExpandedIds.add(id)
        )
        if (item.children) expandInitialNodes(item.children)
      })
    }

    expandInitialNodes(treeItems)
    setExpandedItemIds(Array.from(newAutoExpandedIds))
    initializedRef.current = true
  }, [treeItems, activeFile])

  return {
    treeItems,
    expandedItemIds,
    handleExpand,
    getAllParentIds
  }
}
