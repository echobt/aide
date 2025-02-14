import type { Node, Root } from 'mdast'
import { visit } from 'unist-util-visit'

import { BaseParser } from './base-parser'
import type { Parser } from './types'

type InferParseResult<P> = P extends Parser<infer T>[] ? T : never

export class ParserManager<P extends Parser<any>[]> {
  constructor(private parsers: P) {}

  parseMarkdownContent(content: string): InferParseResult<P>[] {
    const ast = BaseParser.markdownContentToAst(content)
    return this.parseAst(ast)
  }

  parseAst(ast: Root): InferParseResult<P>[] {
    const results: InferParseResult<P>[] = []

    visit(ast, node => {
      const result = this.parseNode(node)
      if (result) results.push(result)
    })

    return results
  }

  parseNode(node: Node): InferParseResult<P> | null {
    for (const parser of this.parsers) {
      const result = parser.parseNode(node)
      if (result) return result
    }

    return null
  }
}
