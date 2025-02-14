/* eslint-disable func-names */
import type { Literal, Parent, Root, RootContent } from 'mdast'
import { toString } from 'mdast-util-to-string'
import type { Plugin } from 'unified'
import type { Position } from 'unist'

// Custom tags that need to be merged
const CUSTOM_TAGS = ['Thinking', 'V1Project'] as const
type CustomTag = (typeof CUSTOM_TAGS)[number]

// Represents a tag block being collected
interface TagBlock {
  tag: CustomTag
  content: string
  startNode: RootContent
  lastNode: RootContent
}

/**
 * Check if a string contains an opening custom tag
 * Returns the tag name if found, null otherwise
 */
const findOpeningTag = (html: string): CustomTag | null => {
  for (const tag of CUSTOM_TAGS) {
    // Skip if it's a complete tag (has both opening and closing)
    if (
      new RegExp(`^\\s*<${tag}[^>]*>[\\s\\S]*</${tag}>\\s*$`, 'i').test(html)
    ) {
      continue
    }

    // Check for opening tag
    if (new RegExp(`^\\s*<${tag}(?:\\s+[^>]*)?>`, 'i').test(html)) {
      return tag
    }
  }
  return null
}

/**
 * Check if a string contains the closing tag for the given custom tag
 */
const hasClosingTag = (html: string, tag: CustomTag): boolean =>
  new RegExp(`.*</${tag}>\\s*$`, 'i').test(html)

/**
 * Create a position object spanning from start node to end node
 */
const createMergedPosition = (
  startNode: RootContent,
  endNode: RootContent
): Position => ({
  start: startNode.position?.start || { line: 0, column: 0, offset: 0 },
  end: endNode.position?.end || { line: 0, column: 0, offset: 0 }
})

/**
 * Remark plugin that merges content within custom tags into single HTML nodes
 */
export const remarkMergeCustomTags: Plugin<[], Root> = function () {
  return function transformer(tree: Root) {
    const processNode = (node: Root | Parent) => {
      // Process children recursively if they exist
      if ('children' in node && Array.isArray(node.children)) {
        node.children = mergeCustomTagBlocks(node.children as RootContent[])
        node.children.forEach(child => {
          if ('children' in child) processNode(child as Parent)
        })
      }
    }

    processNode(tree)
  }
}

/**
 * Merge content within custom tags into single nodes
 */
const mergeCustomTagBlocks = (nodes: RootContent[]): RootContent[] => {
  const result: RootContent[] = []
  let currentBlock: TagBlock | null = null

  for (const node of nodes) {
    if (!currentBlock) {
      // Not collecting - check for opening tag
      if (node.type === 'html') {
        const tag = findOpeningTag((node as Literal).value as string)
        if (tag) {
          currentBlock = {
            tag,
            content: (node as Literal).value as string,
            startNode: node,
            lastNode: node
          }
          continue
        }
      }
      result.push(node)
    } else {
      // Currently collecting a tag block
      currentBlock.lastNode = node

      if (node.type === 'html') {
        const html = (node as Literal).value as string
        if (hasClosingTag(html, currentBlock.tag)) {
          // Found closing tag - create merged node
          currentBlock.content += `\n${html}`
          result.push({
            type: 'html',
            value: currentBlock.content,
            position: createMergedPosition(currentBlock.startNode, node)
          })
          currentBlock = null
        } else {
          currentBlock.content += `\n${html}`
        }
      } else {
        // Convert other node types to string
        currentBlock.content += `\n${toString(node)}`
      }
    }
  }

  // Handle unclosed tag block
  if (currentBlock) {
    result.push({
      type: 'html',
      value: `${currentBlock.content}\n</${currentBlock.tag}>`,
      position: createMergedPosition(
        currentBlock.startNode,
        currentBlock.lastNode
      )
    })
  }

  return result
}
