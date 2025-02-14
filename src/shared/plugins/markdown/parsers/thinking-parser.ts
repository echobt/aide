import type { Html, Node } from 'mdast'

import { parseCustomElement } from '../utils/extract-custom-blocks'
import { BaseParser } from './_base/base-parser'
import type { ThinkingTagInfo } from './_base/types'

export class ThinkingParser extends BaseParser<ThinkingTagInfo> {
  parseNode(_node: Node): ThinkingTagInfo | null {
    if (_node.type !== 'html') return null
    const node = _node as unknown as Html

    let result: ThinkingTagInfo | null = null

    if (this.isXmlTag(node, 'Thinking')) {
      const block = parseCustomElement('Thinking', node.value)

      if (block) {
        result = {
          type: 'xml',
          tagName: 'Thinking',
          isBlockClosed: block.attrs.isBlockClosed === 'true',
          content: block.content,
          otherInfo: {}
        }
      }
    }

    result && this.onParseNodeSuccess?.(result, _node)

    return result
  }
}
