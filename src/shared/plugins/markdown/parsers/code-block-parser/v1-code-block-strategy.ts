import { Code } from 'mdast'

import type { MDCodeInfo, V1ProjectCodeType } from '../_base/types'
import { FALLBACK_LANG } from '../../utils/code-block-utils'
import { BaseCodeBlockStrategy } from './base-code-block-strategy'

export class V1CodeBlockStrategy extends BaseCodeBlockStrategy {
  canParse(codeNode: Code): boolean {
    return /\s*[a-zA-Z0-9_-]+\s*=/.test(codeNode?.meta || '')
  }

  parseNode(codeNode: Code): Omit<MDCodeInfo, 'isBlockClosed'> {
    const mdLang = codeNode.lang?.trim() || ''
    const attrs = this.extractAttributes(codeNode.meta?.trim() || '')

    return {
      type: 'code',
      content: codeNode.value,
      otherInfo: {
        mdLang: mdLang || FALLBACK_LANG,
        v1ProjectFilePath: attrs.file,
        v1ProjectName: attrs.project,
        v1ProjectCodeTitle: attrs.title,
        v1ProjectCodeContentType: attrs.type as V1ProjectCodeType
      }
    }
  }

  private extractAttributes(attrStr: string): Record<string, string> {
    const attributes: Record<string, string> = {}
    const attrPattern = /(\w+)\s*=\s*(?:"([^"]*?)"|'([^']*?)'|([^\s>"']+))/g

    let match
    // eslint-disable-next-line no-cond-assign
    while ((match = attrPattern.exec(attrStr)) !== null) {
      const [, key, doubleQuotedValue, singleQuotedValue, unquotedValue] = match
      if (key) {
        const value = doubleQuotedValue ?? singleQuotedValue ?? unquotedValue
        attributes[key.toLowerCase()] = value || ''
      }
    }

    return attributes
  }
}
