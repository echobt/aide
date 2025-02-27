import type { Node } from 'mdast'

export interface BaseParseResult {
  type: string
  content: string
}

export interface MDTextInfo extends BaseParseResult {
  type: 'text'
}

export type V1ProjectCodeType =
  | 'nodejs'
  | 'html'
  | 'markdown'
  | 'diagram'
  | 'code'
  | string

export interface MDCodeInfo extends BaseParseResult {
  type: 'code'
  isBlockClosed: boolean
  otherInfo?: {
    mdLang?: string
    filePath?: string
    startLine?: number
    endLine?: number

    // v1 project
    v1ProjectFilePath?: string
    v1ProjectName?: string
    v1ProjectCodeTitle?: string
    v1ProjectCodeContentType?: V1ProjectCodeType
  }
}

export interface BaseSpecialMDXmlTagInfo extends BaseParseResult {
  type: 'xml'
  tagName: string
  isBlockClosed: boolean
  otherInfo: Record<string, any>
}

export enum CustomTag {
  V1Project = 'V1Project',
  Thinking = 'Thinking'
}

export interface V1MoveFileTagInfo extends BaseSpecialMDXmlTagInfo {
  tagName: 'MoveFile'
  otherInfo: {
    fromFilePath?: string
    toFilePath?: string
  }
}

export interface V1DeleteFileTagInfo extends BaseSpecialMDXmlTagInfo {
  tagName: 'DeleteFile'
  otherInfo: {
    filePath?: string
  }
}

export interface V1QuickEditTagInfo extends BaseSpecialMDXmlTagInfo {
  tagName: 'QuickEdit'
  otherInfo: {
    filePath?: string
    fileContent?: string
  }
}

export type V1ActionTagInfo =
  | V1MoveFileTagInfo
  | V1DeleteFileTagInfo
  | V1QuickEditTagInfo

export type V1ProjectContent = MDTextInfo | MDCodeInfo | V1ActionTagInfo

export interface V1ProjectTagInfo extends BaseSpecialMDXmlTagInfo {
  tagName: CustomTag.V1Project
  otherInfo: {
    id?: string
    presetName?: string
    parseContents: V1ProjectContent[]
  }
}

export interface ThinkingTagInfo extends BaseSpecialMDXmlTagInfo {
  tagName: CustomTag.Thinking
}

export interface Parser<T extends BaseParseResult = BaseParseResult> {
  parseNode(node: Node, fullMDContent: string): T | null
}
