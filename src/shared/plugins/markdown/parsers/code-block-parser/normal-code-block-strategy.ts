import type { Code } from 'mdast'

import type { MDCodeInfo } from '../_base/types'
import {
  FALLBACK_LANG,
  getFileRangeFromCode
} from '../../utils/code-block-utils'
import { BaseCodeBlockStrategy } from './base-code-block-strategy'

export class NormalCodeBlockStrategy extends BaseCodeBlockStrategy {
  canParse(): boolean {
    return true
  }

  parseNode(codeNode: Code): Omit<MDCodeInfo, 'isBlockClosed'> {
    const [mdLang = FALLBACK_LANG, ...metaParts] =
      codeNode.lang?.trim().split(':') || []
    const content = codeNode.value
    const filePath = metaParts.join(':')
    const { startLine, endLine } = getFileRangeFromCode(content)

    return {
      type: 'code',
      content,
      otherInfo: {
        mdLang,
        filePath,
        startLine,
        endLine
      }
    }
  }
}
