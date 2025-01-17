import type { FileInfo, FolderInfo } from '@extension/file-utils/traverse-fs'
import type { GitProject, Mention, Project } from '@shared/entities'
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
  Errors = `${MentionPluginId.Fs}#errors`,
  Projects = `${MentionPluginId.Fs}#projects`,
  ProjectSetting = `${MentionPluginId.Fs}#project-setting`,
  Project = `${MentionPluginId.Fs}#project`,
  ProjectFile = `${MentionPluginId.Fs}#project-file`,
  ProjectFolder = `${MentionPluginId.Fs}#project-folder`,
  GitProjects = `${MentionPluginId.Fs}#git-projects`,
  GitProject = `${MentionPluginId.Fs}#git-project`,
  GitProjectSetting = `${MentionPluginId.Fs}#git-project-setting`,
  GitProjectFile = `${MentionPluginId.Fs}#git-project-file`,
  GitProjectFolder = `${MentionPluginId.Fs}#git-project-folder`
}

export type FileMention = Mention<FsMentionType.File, FileInfo>
export type FolderMention = Mention<FsMentionType.Folder, FolderInfo>
export type TreeMention = Mention<FsMentionType.Tree, TreeInfo>
export type CodeMention = Mention<FsMentionType.Code, CodeChunk>
export type CodebaseMention = Mention<FsMentionType.Codebase, CodeSnippet[]>
export type ErrorMention = Mention<FsMentionType.Errors, EditorError[]>
export type ProjectMention = Mention<FsMentionType.Project, Project>
export type GitProjectMention = Mention<FsMentionType.GitProject, GitProject>

export type FsMention =
  | FileMention
  | FolderMention
  | TreeMention
  | CodeMention
  | CodebaseMention
  | ErrorMention
  | ProjectMention
  | GitProjectMention

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
  schemeUri: string
  line: number
  column: number
}

export interface TreeInfo {
  type: 'tree'
  schemeUri: string // root folder scheme path
  treeString: string // markdown tree string, for user reading
  listString: string // markdown list string, for ai reading
}
