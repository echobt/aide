import path from 'path'
import {
  getTreeInfo,
  getWorkspaceTreesInfo
} from '@extension/file-utils/generate-tree'
import {
  traverseFileOrFolders,
  type FileInfo,
  type FolderInfo
} from '@extension/file-utils/traverse-fs'
import { VsCodeFS } from '@extension/file-utils/vscode-fs'
import { logger } from '@extension/logger'
import { getWorkspaceFolder } from '@extension/utils'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { EditorError, TreeInfo } from '@shared/plugins/fs-plugin/types'
import * as vscode from 'vscode'

export class FileActionsCollection extends ServerActionCollection {
  readonly categoryName = 'file'

  async readFile(
    context: ActionContext<{
      path: string
      encoding?: BufferEncoding
    }>
  ): Promise<string> {
    const { actionParams } = context
    const { path, encoding } = actionParams
    return await VsCodeFS.readFileOrOpenDocumentContent(path, encoding)
  }

  async writeFile(
    context: ActionContext<{
      path: string
      data: string
      encoding?: BufferEncoding
    }>
  ): Promise<void> {
    const { actionParams } = context
    const { path, data, encoding } = actionParams
    await VsCodeFS.writeFile(path, data, encoding)
  }

  async mkdir(
    context: ActionContext<{ path: string; recursive?: boolean }>
  ): Promise<void> {
    const { actionParams } = context
    const { path, recursive } = actionParams
    await VsCodeFS.mkdir(path, { recursive })
  }

  async rmdir(
    context: ActionContext<{ path: string; recursive?: boolean }>
  ): Promise<void> {
    const { actionParams } = context
    const { path, recursive } = actionParams
    await VsCodeFS.rmdir(path, { recursive })
  }

  async unlink(context: ActionContext<{ path: string }>): Promise<void> {
    const { actionParams } = context
    const { path } = actionParams
    await VsCodeFS.unlink(path)
  }

  async rename(
    context: ActionContext<{ oldPath: string; newPath: string }>
  ): Promise<void> {
    const { actionParams } = context
    const { oldPath, newPath } = actionParams
    await VsCodeFS.rename(oldPath, newPath)
  }

  async stat(
    context: ActionContext<{ path: string }>
  ): Promise<vscode.FileStat> {
    const { actionParams } = context
    const { path } = actionParams
    return await VsCodeFS.stat(path)
  }

  async readdir(context: ActionContext<{ path: string }>): Promise<string[]> {
    const { actionParams } = context
    const { path } = actionParams
    return await VsCodeFS.readdir(path)
  }

  async getFullPath(
    context: ActionContext<{
      path: string
      returnNullIfNotExists?: boolean
    }>
  ): Promise<string | null> {
    const { actionParams } = context
    const { path: filePath, returnNullIfNotExists } = actionParams
    try {
      const workspaceFolder = getWorkspaceFolder()
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath)
      const stat = await VsCodeFS.stat(absolutePath)

      if (
        returnNullIfNotExists &&
        stat.type !== vscode.FileType.File &&
        stat.type !== vscode.FileType.Directory
      )
        return null

      return absolutePath
    } catch {
      return null
    }
  }

  async getFileInfoForMessage(
    context: ActionContext<{
      relativePath: string
      startLine?: number
      endLine?: number
    }>
  ): Promise<FileInfo | null> {
    const { actionParams } = context
    const { relativePath, startLine, endLine } = actionParams
    try {
      const workspaceFolder = getWorkspaceFolder()
      const fullPath = path.join(workspaceFolder.uri.fsPath, relativePath)
      const fileInfo = await VsCodeFS.stat(fullPath)

      if (!fileInfo || fileInfo.type !== vscode.FileType.File) return null

      const fileContent = await VsCodeFS.readFile(fullPath)
      const lines = fileContent.split('\n')
      const finalStartLine = startLine ?? 0
      const finalEndLine = endLine ?? lines.length - 1
      const code = lines.slice(finalStartLine, finalEndLine + 1).join('\n')

      return {
        type: 'file',
        content: code,
        relativePath,
        fullPath
      }
    } catch (error) {
      logger.error('Error getting file info for message:', error)
      return null
    }
  }

  async openFileInEditor(
    context: ActionContext<{
      path: string
      startLine?: number
    }>
  ): Promise<void> {
    const { actionParams } = context
    const { path: filePath, startLine } = actionParams

    if (!filePath) return

    const document = await vscode.workspace.openTextDocument(filePath)
    const startPosition = new vscode.Position(startLine ?? 0, 0)

    await vscode.window.showTextDocument(document, {
      preview: true,
      selection: new vscode.Range(startPosition, startPosition)
    })
  }

  async traverseWorkspaceFiles(
    context: ActionContext<{ filesOrFolders: string[] }>
  ): Promise<FileInfo[]> {
    const { actionParams } = context
    const { filesOrFolders } = actionParams
    const workspaceFolder = getWorkspaceFolder()
    return await traverseFileOrFolders({
      type: 'file',
      filesOrFolders,
      isGetFileContent: false,
      workspacePath: workspaceFolder.uri.fsPath,
      itemCallback: fileInfo => fileInfo
    })
  }

  async traverseWorkspaceFolders(
    context: ActionContext<{ folders: string[] }>
  ): Promise<FolderInfo[]> {
    const { actionParams } = context
    const { folders } = actionParams
    const workspaceFolder = getWorkspaceFolder()
    return await traverseFileOrFolders({
      type: 'folder',
      filesOrFolders: folders,
      isGetFileContent: false,
      workspacePath: workspaceFolder.uri.fsPath,
      itemCallback: folderInfo => folderInfo
    })
  }

  async getCurrentEditorErrors(
    context: ActionContext<{}>
  ): Promise<EditorError[]> {
    const errors: EditorError[] = []

    try {
      // Get all open text documents
      const documents = vscode.workspace.textDocuments

      // Collect diagnostics for each document
      for (const document of documents) {
        // Skip non-file documents (like output/debug console)
        if (document.uri.scheme !== 'file') continue

        // Get all diagnostic collections
        const allDiagnostics: vscode.Diagnostic[] = []

        // Get diagnostics from all providers (TypeScript, ESLint, etc)
        const collections = vscode.languages.getDiagnostics(document.uri)
        allDiagnostics.push(...collections)

        // Get diagnostics from other language features
        const languageFeatures = vscode.languages.getDiagnostics()
        for (const [uri, diagnostics] of languageFeatures) {
          if (uri.toString() === document.uri.toString()) {
            allDiagnostics.push(...diagnostics)
          }
        }

        // Convert diagnostics to EditorError format
        const documentErrors = allDiagnostics.map(d => {
          // Try to get more specific error source/type
          const source = d.source || 'unknown'
          const code = d.code
            ? typeof d.code === 'object'
              ? d.code.value
              : d.code.toString()
            : undefined

          // Format code with source if available
          const errorCode = source && code ? `${source}/${code}` : code

          return {
            message: d.message,
            code: String(errorCode || ''),
            severity:
              d.severity === vscode.DiagnosticSeverity.Error
                ? 'error'
                : 'warning',
            file: vscode.workspace.asRelativePath(document.uri),
            line: d.range.start.line + 1,
            column: d.range.start.character + 1
          } satisfies EditorError
        })

        errors.push(...documentErrors)
      }

      // Remove duplicates based on message and location
      return errors.filter(
        (error, index, self) =>
          index ===
          self.findIndex(
            e =>
              e.message === error.message &&
              e.file === error.file &&
              e.line === error.line &&
              e.column === error.column
          )
      )
    } catch (error) {
      logger.error('Error getting editor diagnostics:', error)
      return []
    }
  }

  async getTreeInfo(
    context: ActionContext<{ path: string }>
  ): Promise<TreeInfo | undefined> {
    const { actionParams } = context
    const { path: filePath } = actionParams

    try {
      const workspaceFolder = getWorkspaceFolder()
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath)

      return await getTreeInfo(fullPath)
    } catch (error) {
      logger.error('Error getting tree info:', error)
      return undefined
    }
  }

  async getWorkspaceTreesInfo(
    context: ActionContext<{ depth?: number }>
  ): Promise<TreeInfo[]> {
    const { actionParams } = context
    const { depth } = actionParams

    try {
      return await getWorkspaceTreesInfo(depth)
    } catch (error) {
      logger.error('Error getting workspace trees info:', error)
      return []
    }
  }
}
