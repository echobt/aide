import type { Html, Node } from 'mdast'

import { parseCustomElement } from '../utils/extract-custom-blocks'
import { BaseParser } from './_base/base-parser'
import { CustomTag, type ThinkingTagInfo } from './_base/types'

export class ThinkingParser extends BaseParser<ThinkingTagInfo> {
  parseNode(_node: Node, fullMDContent: string): ThinkingTagInfo | null {
    if (_node.type !== 'html') return null
    const node = _node as unknown as Html

    let result: ThinkingTagInfo | null = null

    if (this.isXmlTag(node, CustomTag.Thinking)) {
      const block = parseCustomElement(CustomTag.Thinking, node.value)

      if (block) {
        result = {
          type: 'xml',
          tagName: CustomTag.Thinking,
          isBlockClosed: block.attrs.isBlockClosed === 'true',
          content: block.content,
          otherInfo: {}
        }
      }
    }

    result && this.onParseNodeSuccess?.(result, _node, fullMDContent)

    return result
  }
}
