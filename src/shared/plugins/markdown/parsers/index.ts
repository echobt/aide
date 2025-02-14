import type { BaseParserOptions } from './_base/base-parser'
import { ParserManager } from './_base/parser-manager'
import type {
  MDCodeInfo,
  ThinkingTagInfo,
  V1ProjectTagInfo
} from './_base/types'
import { CodeBlockParser } from './code-block-parser'
import { ThinkingParser } from './thinking-parser'
import { V1ProjectParser } from './v1-project-parser'

export * from './_base/types'
export * from './_base/parser-manager'

export const createParseManager = (
  options?: BaseParserOptions<MDCodeInfo | V1ProjectTagInfo | ThinkingTagInfo>
) => {
  const manager = new ParserManager([
    new CodeBlockParser(options as BaseParserOptions<MDCodeInfo>),
    new V1ProjectParser(options as BaseParserOptions<V1ProjectTagInfo>),
    new ThinkingParser(options as BaseParserOptions<ThinkingTagInfo>)
  ] as const)
  return manager
}
