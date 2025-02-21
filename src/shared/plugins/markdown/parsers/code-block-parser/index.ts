import type { Code, Node } from 'mdast'

import { BaseParser, type BaseParserOptions } from '../_base/base-parser'
import type { MDCodeInfo } from '../_base/types'
import { isCodeBlockClosed } from '../../utils/common'
import type { CodeBlockStrategy } from './base-code-block-strategy'
import { NormalCodeBlockStrategy } from './normal-code-block-strategy'
import { V1CodeBlockStrategy } from './v1-code-block-strategy'

export class CodeBlockParser extends BaseParser<MDCodeInfo> {
  private strategies: CodeBlockStrategy[]

  constructor(options?: BaseParserOptions<MDCodeInfo>) {
    super(options)
    this.strategies = [new NormalCodeBlockStrategy(), new V1CodeBlockStrategy()]
  }

  parseNode(_node: Node, fullMDContent: string): MDCodeInfo | null {
    if (_node.type !== 'code') return null
    const node = _node as unknown as Code

    let result: MDCodeInfo | null = null

    const isBlockClosed = isCodeBlockClosed(node.value, fullMDContent)
    const parseResults = this.strategies
      .filter(strategy => strategy.canParse(node))
      .map(strategy => strategy.parseNode(node, fullMDContent))
      .map(result => ({
        ...result,
        isBlockClosed
      }))

    if (parseResults.length > 0) {
      result = this.mergeResults(parseResults as MDCodeInfo[])
    } else {
      result = {
        type: 'code',
        content: node.value,
        isBlockClosed,
        otherInfo: {
          mdLang: node.lang?.trim() || ''
        }
      }
    }

    result && this.onParseNodeSuccess?.(result, _node, fullMDContent)

    return result
  }

  private mergeResults(results: MDCodeInfo[]): MDCodeInfo {
    return results.reduce((merged, current) => ({
      type: 'code',
      content: current.content || merged.content,
      isBlockClosed: current.isBlockClosed ?? merged.isBlockClosed,
      otherInfo: {
        mdLang: current.otherInfo?.mdLang || merged.otherInfo?.mdLang || '',
        filePath:
          current.otherInfo?.filePath || merged.otherInfo?.filePath || '',
        startLine:
          current.otherInfo?.startLine ||
          merged.otherInfo?.startLine ||
          undefined,
        endLine:
          current.otherInfo?.endLine || merged.otherInfo?.endLine || undefined,

        // v1 project
        v1ProjectFilePath:
          current.otherInfo?.v1ProjectFilePath ||
          merged.otherInfo?.v1ProjectFilePath ||
          '',
        v1ProjectName:
          current.otherInfo?.v1ProjectName ||
          merged.otherInfo?.v1ProjectName ||
          '',
        v1ProjectCodeTitle:
          current.otherInfo?.v1ProjectCodeTitle ||
          merged.otherInfo?.v1ProjectCodeTitle ||
          '',
        v1ProjectCodeContentType:
          current.otherInfo?.v1ProjectCodeContentType ||
          merged.otherInfo?.v1ProjectCodeContentType ||
          ''
      }
    }))
  }
}
