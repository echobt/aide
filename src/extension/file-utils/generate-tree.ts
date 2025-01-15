import path from 'path'
import { logger } from '@extension/logger'
import type { TreeInfo } from '@shared/plugins/mentions/fs-mention-plugin/types'

import { traverseFileOrFolders, type FsItemInfo } from './traverse-fs'
import { vfs } from './vfs'
import { workspaceSchemeHandler } from './vfs/schemes/workspace-scheme'

interface TreeNode {
  name: string
  schemeUri: string
  isDirectory: boolean
  children: TreeNode[]
  depth: number
}

class TreeBuilder {
  private rootNodes: TreeNode[] = []

  constructor(private items: FsItemInfo[]) {}

  async build(): Promise<TreeNode[]> {
    // Create node map for O(1) lookup
    const nodeMap = new Map<string, TreeNode>()

    // Group items by depth for level-by-level processing
    // Time: O(n), Space: O(n)
    const depthGroups: FsItemInfo[][] = []
    for (const item of this.items) {
      const relativePath = vfs.resolveRelativePathProSync(item.schemeUri)
      const depth = ['', '.', './', '.\\'].includes(relativePath)
        ? 0
        : relativePath.split(path.sep).length
      if (!depthGroups[depth]) depthGroups[depth] = []
      depthGroups[depth]!.push(item)
    }

    // Process nodes level by level, from root to leaves
    // This ensures parents are always created before children
    // Time: O(n log k) where k is max nodes at same level
    for (const group of depthGroups) {
      if (!group) continue

      // Process nodes at the same level
      // These could potentially be processed in parallel
      for (const item of group) {
        const relativePath = vfs.resolveRelativePathProSync(item.schemeUri)
        const fullPath = await vfs.resolveFullPathProAsync(
          item.schemeUri,
          false
        )
        const node: TreeNode = {
          name: path.basename(relativePath),
          schemeUri: item.schemeUri,
          isDirectory: item.type === 'folder',
          children: [],
          depth: relativePath === '.' ? 0 : relativePath.split(path.sep).length
        }
        nodeMap.set(fullPath, node)

        // Find and link to parent
        // Parent is guaranteed to exist in nodeMap if it's not a root
        const parentPath = path.dirname(fullPath)
        const parent = nodeMap.get(parentPath)

        if (parent) {
          parent.children.push(node)
        } else {
          this.rootNodes.push(node)
        }
      }

      // Sort nodes at current level
      // Time: O(k log k) where k is number of nodes at this level
      for (const node of nodeMap.values()) {
        if (node.depth === depthGroups.indexOf(group)) {
          this.sortNodes(node.children)
        }
      }
    }

    // Finally sort root nodes
    this.sortNodes(this.rootNodes)
    return this.rootNodes
  }

  toListString(): string {
    const paths: string[] = []

    const collectPaths = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        const relativePath = vfs.resolveRelativePathProSync(node.schemeUri)
        paths.push(relativePath)
        if (node.children.length > 0) {
          collectPaths(node.children)
        }
      }
    }

    collectPaths(this.rootNodes)
    return paths.join('\n')
  }

  /**
   * Sort nodes with directories first, then alphabetically
   * Time: O(n log n) where n is number of nodes to sort
   */
  private sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name)
      }
      return a.isDirectory ? -1 : 1
    })
  }
}

class TreeFormatter {
  static async toTreeString(
    tree: TreeNode[],
    prefix = '',
    isRoot = true
  ): Promise<string> {
    let result = ''

    for (let index = 0; index < tree.length; index++) {
      const node = tree[index]!
      const isLast = index === tree.length - 1
      const connector = isRoot ? '' : isLast ? '└── ' : '├── '
      const childPrefix = isRoot ? '' : isLast ? '    ' : '│   '
      const relativePath = vfs.resolveRelativePathProSync(node.schemeUri)

      result += `${prefix + connector + (isRoot ? relativePath : node.name)}\n`
      if (node.children.length > 0) {
        result += await this.toTreeString(
          node.children,
          prefix + childPrefix,
          false
        )
      }
    }

    return result
  }

  static toListString(tree: TreeNode[]): string {
    const paths: string[] = []

    const collectPaths = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        const relativePath = vfs.resolveRelativePathProSync(node.schemeUri)
        paths.push(relativePath)
        if (node.children.length > 0) {
          collectPaths(node.children)
        }
      }
    }

    collectPaths(tree)
    return paths.join('\n')
  }
}

/**
 * Get tree info for a directory
 */
export const getTreeInfo = async (
  schemeUri: string
): Promise<TreeInfo | undefined> => {
  try {
    const stat = await vfs.promises.stat(schemeUri)

    if (!stat.isDirectory()) return

    const items = await traverseFileOrFolders({
      type: 'fileOrFolder',
      schemeUris: [schemeUri],
      isGetFileContent: false,
      itemCallback: item => item
    })

    const tree = await new TreeBuilder(items).build()
    const treeString = await TreeFormatter.toTreeString(tree)
    const listString = TreeFormatter.toListString(tree)

    return {
      type: 'tree',
      schemeUri,
      treeString,
      listString
    }
  } catch (error) {
    logger.error('Error getting tree info:', error)
    return undefined
  }
}

/**
 * Get tree info for multiple directories in workspace with depth limit
 */
export const getWorkspaceTreesInfo = async (depth = 5): Promise<TreeInfo[]> => {
  try {
    const workspaceSchemeUri = workspaceSchemeHandler.createSchemeUri({
      relativePath: './'
    })

    const items = await traverseFileOrFolders({
      type: 'fileOrFolder',
      schemeUris: [workspaceSchemeUri],
      isGetFileContent: false,
      itemCallback: item => item
    })

    const treeBuilder = new TreeBuilder(items)
    const fullTree = await treeBuilder.build()
    const treeInfos: TreeInfo[] = []

    const processDirectory = async (node: TreeNode): Promise<void> => {
      if (!node.isDirectory || node.depth > depth || !node.children.length)
        return

      const treeString = await TreeFormatter.toTreeString([node])
      const listString = TreeFormatter.toListString([node])

      treeInfos.push({
        type: 'tree',
        schemeUri: node.schemeUri,
        treeString,
        listString
      })

      node.children.forEach(processDirectory)
    }

    for (const node of fullTree) {
      await processDirectory(node)
    }

    return treeInfos.sort((a, b) => a.schemeUri.localeCompare(b.schemeUri))
  } catch (error) {
    logger.error('Error getting workspace trees info:', error)
    return []
  }
}
