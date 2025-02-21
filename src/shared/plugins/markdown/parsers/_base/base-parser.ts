import type { Literal, Node, Root } from 'mdast'
import rehypeRaw from 'rehype-raw'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { extractCustomBlocks } from '../../utils/extract-custom-blocks'
import { fixMarkdownContent } from '../../utils/fix-markdown-content'
import type { BaseParseResult, Parser } from './types'

type OnParseNodeSuccess<T extends BaseParseResult = BaseParseResult> = (
  result: T,
  node: Node,
  fullMDContent: string
) => void

export interface BaseParserOptions<
  T extends BaseParseResult = BaseParseResult
> {
  onParseNodeSuccess?: OnParseNodeSuccess<T>
}

export abstract class BaseParser<T extends BaseParseResult = BaseParseResult>
  implements Parser<T>
{
  static processor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)

  static markdownContentToAst(content: string): Root {
    const { processedMarkdown } = extractCustomBlocks(
      fixMarkdownContent(content),
      ['V1Project', 'Thinking']
    )
    return this.processor.parse(processedMarkdown) as Root
  }

  protected onParseNodeSuccess?: OnParseNodeSuccess<T>

  constructor(options?: BaseParserOptions<T>) {
    this.onParseNodeSuccess = options?.onParseNodeSuccess
  }

  abstract parseNode(node: Node, fullMDContent: string): T | null

  parseMarkdownContent(content: string, fullMDContent: string): T[] {
    const ast = BaseParser.markdownContentToAst(content)
    const results: T[] = []
    visit(ast, node => {
      const result = this.parseNode(node, fullMDContent)
      if (result) results.push(result)
    })

    return results
  }

  /**
   * Check if the node is a specific XML tag
   * Supports:
   * - Case-insensitive
   * - Allow leading spaces
   * - Allow trailing spaces after the tag name
   * - Self-closing tags
   * - Tags with attributes
   */
  protected isXmlTag(node: Literal, tagName: string): boolean {
    if (node.type !== 'html') return false

    // Convert to lowercase for comparison
    const normalizedTagName = tagName.toLowerCase()
    const value = node.value.trim()

    // Match start tags
    // 1. <tagName>
    // 2. <tagName />
    // 3. <tagName attr="value">
    const startPattern = new RegExp(
      `^<${normalizedTagName}(?:\\s+[^>]*)?\\s*(?:>|/>)$`,
      'i'
    )

    // Match end tags
    const endPattern = new RegExp(`^</${normalizedTagName}\\s*>$`, 'i')

    return startPattern.test(value) || endPattern.test(value)
  }
}
