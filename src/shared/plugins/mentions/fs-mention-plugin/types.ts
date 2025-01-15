import type { FileInfo, FolderInfo } from '@extension/file-utils/traverse-fs'
import type { Mention } from '@shared/entities'
import type { CodeSnippet } from '@shared/plugins/agents/codebase-search-agent-plugin/types'

import { MentionPluginId } from '../_base/types'

export enum FsMentionType {
  Files = `${MentionPluginId.Fs}#files`,
  File = `${MentionPluginId.Fs}#file`,
  Folders = `${MentionPluginId.Fs}#folders`,
  Folder = `${MentionPluginId.Fs}#folder`,
  Trees = `${MentionPluginId.Fs}#trees`,
  Tree = `${MentionPluginId.Fs}#tree`,
  Code = `${MentionPluginId.Fs}#code`,
  Codebase = `${MentionPluginId.Fs}#codebase`,
  Errors = `${MentionPluginId.Fs}#errors`
}

export type FileMention = Mention<FsMentionType.File, FileInfo>
export type FolderMention = Mention<FsMentionType.Folder, FolderInfo>
export type TreeMention = Mention<FsMentionType.Tree, TreeInfo>
export type CodeMention = Mention<FsMentionType.Code, CodeChunk>
export type CodebaseMention = Mention<FsMentionType.Codebase, CodeSnippet[]>
export type ErrorMention = Mention<FsMentionType.Errors, EditorError[]>

export type FsMention =
  | FileMention
  | FolderMention
  | TreeMention
  | CodeMention
  | CodebaseMention
  | ErrorMention

export interface CodeChunk {
  code: string
  language: string
  schemeUri: string
  startLine?: number
  endLine?: number
}

export interface EditorError {
  message: string
  code?: string
  severity: 'error' | 'warning'
  file: string
  line: number
  column: number
}

export interface TreeInfo {
  type: 'tree'
  schemeUri: string // root folder scheme path
  treeString: string // markdown tree string, for user reading
  listString: string // markdown list string, for ai reading
}
