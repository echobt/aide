import type { Stats } from 'fs'
import {
  getTreeInfo,
  getWorkspaceTreesInfo
} from '@extension/file-utils/generate-tree'
import {
  traverseFileOrFolders,
  type FileInfo,
  type FolderInfo
} from '@extension/file-utils/traverse-fs'
import { vfs } from '@extension/file-utils/vfs'
import { workspaceSchemeHandler } from '@extension/file-utils/vfs/schemes/workspace-scheme'
import { logger } from '@extension/logger'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type {
  EditorError,
  TreeInfo
} from '@shared/plugins/mentions/fs-mention-plugin/types'
import { settledPromiseResults } from '@shared/utils/common'
import * as vscode from 'vscode'

export class FileActionsCollection extends ServerActionCollection {
  readonly categoryName = 'file'

  async readFile(
    context: ActionContext<{
      schemeUri: string
      encoding?: BufferEncoding
    }>
  ): Promise<string> {
    const { actionParams } = context
    const { schemeUri, encoding } = actionParams
    const finalSchemeUri = await vfs.fixSchemeUri(schemeUri)
    return await vfs.readFilePro(finalSchemeUri, encoding ?? 'utf-8')
  }

  async writeFile(
    context: ActionContext<{
      schemeUri: string
      data: string
      encoding?: BufferEncoding
    }>
  ): Promise<void> {
    const { actionParams } = context
    const { schemeUri, data, encoding } = actionParams
    const finalSchemeUri = await vfs.fixSchemeUri(schemeUri)
    await vfs.promises.writeFile(finalSchemeUri, data, encoding ?? 'utf-8')
  }

  async mkdir(
    context: ActionContext<{ schemeUri: string; recursive?: boolean }>
  ): Promise<void> {
    const { actionParams } = context
    const { schemeUri, recursive } = actionParams
    const finalSchemeUri = await vfs.fixSchemeUri(schemeUri)
    await vfs.promises.mkdir(finalSchemeUri, { recursive })
  }

  async rmdir(
    context: ActionContext<{ schemeUri: string; recursive?: boolean }>
  ): Promise<void> {
    const { actionParams } = context
    const { schemeUri, recursive } = actionParams
    const finalSchemeUri = await vfs.fixSchemeUri(schemeUri)
    await vfs.promises.rmdir(finalSchemeUri, { recursive })
  }

  async unlink(context: ActionContext<{ schemeUri: string }>): Promise<void> {
    const { actionParams } = context
    const { schemeUri } = actionParams
    const finalSchemeUri = await vfs.fixSchemeUri(schemeUri)
    await vfs.promises.unlink(finalSchemeUri)
  }

  async rename(
    context: ActionContext<{ oldSchemeUri: string; newSchemeUri: string }>
  ): Promise<void> {
    const { actionParams } = context
    const { oldSchemeUri, newSchemeUri } = actionParams
    const finalOldSchemeUri = await vfs.fixSchemeUri(oldSchemeUri)
    const finalNewSchemeUri = await vfs.fixSchemeUri(newSchemeUri)
    await vfs.promises.rename(finalOldSchemeUri, finalNewSchemeUri)
  }

  async stat(context: ActionContext<{ schemeUri: string }>): Promise<Stats> {
    const { actionParams } = context
    const { schemeUri } = actionParams
    const finalSchemeUri = await vfs.fixSchemeUri(schemeUri)
    return await vfs.promises.stat(finalSchemeUri)
  }

  async readdir(
    context: ActionContext<{ schemeUri: string }>
  ): Promise<string[]> {
    const { actionParams } = context
    const { schemeUri } = actionParams
    const finalSchemeUri = await vfs.fixSchemeUri(schemeUri)
    return await vfs.promises.readdir(finalSchemeUri)
  }

  async resolveFullPath(
    context: ActionContext<{
      schemeUri: string
      returnNullIfNotExists?: boolean
    }>
  ): Promise<string | null> {
    const { actionParams } = context
    const { schemeUri, returnNullIfNotExists } = actionParams
    const finalSchemeUri = await vfs.fixSchemeUri(schemeUri)
    return await vfs.resolveFullPathProAsync(
      finalSchemeUri,
      returnNullIfNotExists ?? false
    )
  }

  async getFileInfoForMessage(
    context: ActionContext<{
      schemeUri: string
      startLine?: number
      endLine?: number
      skipErr?: boolean
    }>
  ): Promise<FileInfo | null> {
    const { actionParams } = context
    const { schemeUri, startLine, endLine, skipErr } = actionParams
    try {
      if (!schemeUri) return null

      const finalSchemeUri = await vfs.fixSchemeUri(schemeUri)
      const fileStat = await vfs.promises.stat(finalSchemeUri)
      if (!fileStat.isFile()) return null

      const fileContent = await vfs.promises.readFile(finalSchemeUri, 'utf-8')
      const lines = fileContent.split('\n')
      const finalStartLine = startLine ?? 0
      const finalEndLine = endLine ?? lines.length - 1
      const code = lines.slice(finalStartLine, finalEndLine + 1).join('\n')

      return {
        type: 'file',
        content: code,
        schemeUri: finalSchemeUri
      }
    } catch (error) {
      if (!skipErr) {
        logger.error('Error getting file info for message:', error)
      }
      return null
    }
  }

  async openFileInEditor(
    context: ActionContext<{
      schemeUri: string
      startLine?: number
    }>
  ): Promise<void> {
    const { actionParams } = context
    const { schemeUri, startLine } = actionParams

    if (!schemeUri) return

    const fullPath = await vfs.resolveFullPathProAsync(schemeUri, true)
    if (!fullPath) return

    const document = await vscode.workspace.openTextDocument(fullPath)
    const startPosition = new vscode.Position(startLine ?? 0, 0)

    await vscode.window.showTextDocument(document, {
      preview: true,
      selection: new vscode.Range(startPosition, startPosition)
    })
  }

  async traverseWorkspaceFiles(
    context: ActionContext<{ schemeUris: string[] }>
  ): Promise<FileInfo[]> {
    const { actionParams } = context
    const { schemeUris } = actionParams
    const finalSchemeUris = await settledPromiseResults(
      schemeUris.map(async schemeUri => await vfs.fixSchemeUri(schemeUri))
    )

    return await traverseFileOrFolders({
      type: 'file',
      schemeUris: finalSchemeUris,
      isGetFileContent: false,
      itemCallback: fileInfo => fileInfo
    })
  }

  async traverseWorkspaceFolders(
    context: ActionContext<{ schemeUris: string[] }>
  ): Promise<FolderInfo[]> {
    const { actionParams } = context
    const { schemeUris } = actionParams
    const finalSchemeUris = await settledPromiseResults(
      schemeUris.map(async schemeUri => await vfs.fixSchemeUri(schemeUri))
    )
    return await traverseFileOrFolders({
      type: 'folder',
      schemeUris: finalSchemeUris,
      isGetFileContent: false,
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
            schemeUri: workspaceSchemeHandler.createSchemeUri({
              fullPath: document.uri.fsPath
            }),
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
              e.schemeUri === error.schemeUri &&
              e.line === error.line &&
              e.column === error.column
          )
      )
    } catch (error) {
      logger.error('Error getting editor diagnostics:', error)
      return []
    }
  }

  async getCurrentFile(context: ActionContext<{}>): Promise<FileInfo | null> {
    try {
      // get the current file from the editor
      const editor = vscode.window.activeTextEditor
      if (!editor) return null

      const fileInfo = await traverseFileOrFolders({
        type: 'file',
        schemeUris: [await vfs.fixSchemeUri(editor.document.uri.fsPath)],
        isGetFileContent: false,
        itemCallback: fileInfo => fileInfo
      })
      return fileInfo?.[0] ?? null
    } catch (error) {
      logger.error('Error getting current file:', error)
      return null
    }
  }

  async getTreeInfo(
    context: ActionContext<{ schemeUri: string }>
  ): Promise<TreeInfo | undefined> {
    const { actionParams } = context
    const { schemeUri } = actionParams
    const finalSchemeUri = await vfs.fixSchemeUri(schemeUri)

    try {
      return await getTreeInfo(finalSchemeUri)
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
