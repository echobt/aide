import type { Html, Node, Parent } from 'mdast'
import { visit } from 'unist-util-visit'

import { parseCustomElement } from '../utils/extract-custom-blocks'
import { BaseParser } from './_base/base-parser'
import {
  CustomTag,
  type MDCodeInfo,
  type MDTextInfo,
  type V1ActionTagInfo,
  type V1ProjectCodeType,
  type V1ProjectContent,
  type V1ProjectTagInfo
} from './_base/types'
import { CodeBlockParser } from './code-block-parser'

export class V1ProjectParser extends BaseParser<V1ProjectTagInfo> {
  parseNode(_node: Node, fullMDContent: string): V1ProjectTagInfo | null {
    if (_node.type !== 'html') return null
    const node = _node as unknown as Html

    let result: V1ProjectTagInfo | null = null

    if (this.isXmlTag(node, CustomTag.V1Project)) {
      const block = parseCustomElement(CustomTag.V1Project, node.value)

      if (block) {
        const { attrs } = block
        const innerContent = block.content
        const parsedInnerContents = this.parseInnerContent(innerContent)

        // TODO: add more preset for code type
        const innerCodeTypePresetNameMap: Record<V1ProjectCodeType, string> = {
          nodejs: '',
          html: '',
          markdown: '',
          diagram: '',
          code: ''
        }

        let innerPresetName = ''
        parsedInnerContents.forEach(content => {
          if (content.type === 'code') {
            const codeType = content.otherInfo?.v1ProjectCodeContentType || ''
            innerPresetName = innerCodeTypePresetNameMap[codeType] || ''
          }
        })

        const presetName = String(attrs.presetName || innerPresetName || '')

        result = {
          type: 'xml',
          tagName: CustomTag.V1Project,
          isBlockClosed: attrs.isBlockClosed === 'true',
          content: innerContent,
          otherInfo: {
            id: attrs.id as string,
            presetName,
            parseContents: parsedInnerContents
          }
        }
      }
    }

    result && this.onParseNodeSuccess?.(result, _node, fullMDContent)

    return result
  }

  parseInnerContent(innerContent: string): V1ProjectContent[] {
    const contents: Array<MDTextInfo | MDCodeInfo | V1ActionTagInfo> = []
    const ast = BaseParser.markdownContentToAst(innerContent)

    // Parse code blocks
    const codeParser = new CodeBlockParser()

    visit(ast, node => {
      if (node.type === 'html') {
        // Parse file operation tags
        if (this.isXmlTag(node, 'MoveFile')) {
          const block = parseCustomElement('MoveFile', node.value)

          if (block) {
            const { attrs } = block
            contents.push({
              type: 'xml',
              tagName: 'MoveFile',
              content: '',
              isBlockClosed: true,
              otherInfo: {
                fromFilePath: attrs.from as string,
                toFilePath: attrs.to as string
              }
            })
          }
        }

        if (this.isXmlTag(node, 'DeleteFile')) {
          const block = parseCustomElement('DeleteFile', node.value)

          if (block) {
            const { attrs } = block
            contents.push({
              type: 'xml',
              tagName: 'DeleteFile',
              content: '',
              isBlockClosed: true,
              otherInfo: {
                filePath: attrs.file as string
              }
            })
          }
        }
      }

      // Parse text content
      if (node.type === 'text') {
        if (node.value.trim()) {
          contents.push({
            type: 'text',
            content: node.value
          })
        }
      }

      const codeBlockInfo = codeParser.parseNode(
        node as unknown as Parent,
        innerContent
      )
      if (codeBlockInfo) {
        contents.push(codeBlockInfo)
      }
    })

    return contents
  }
}
