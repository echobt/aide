import type { Code } from 'mdast'

import type { MDCodeInfo } from '../_base/types'

export interface CodeBlockStrategy {
  canParse(codeNode: Code): boolean
  parseNode(
    codeNode: Code,
    fullMDContent: string
  ): Omit<MDCodeInfo, 'isBlockClosed'>
}

export abstract class BaseCodeBlockStrategy implements CodeBlockStrategy {
  abstract canParse(codeNode: Code): boolean
  abstract parseNode(
    codeNode: Code,
    fullMDContent: string
  ): Omit<MDCodeInfo, 'isBlockClosed'>
}
