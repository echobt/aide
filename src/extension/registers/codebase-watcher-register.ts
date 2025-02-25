import { CodebaseIndexer } from '@extension/chat/vectordb/codebase-indexer'
import { aidePaths } from '@extension/file-utils/paths'
import { workspaceSchemeHandler } from '@extension/file-utils/vfs/schemes/workspace-scheme'
import * as vscode from 'vscode'

import { BaseRegister } from './base-register'

export class CodebaseWatcherRegister extends BaseRegister {
  private fileSystemWatcher: vscode.FileSystemWatcher | undefined

  private disposables: vscode.Disposable[] = []

  indexer: CodebaseIndexer | undefined

  async register(): Promise<void> {
    const dbPath = await aidePaths.getWorkspacePostgresPath()
    this.indexer = new CodebaseIndexer(dbPath)

    // Initialize the indexer
    await this.indexer.initialize()

    // Create a file system watcher for all files
    this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*')

    // Handle file changes
    this.disposables.push(
      this.fileSystemWatcher.onDidChange(uri =>
        this.handleFileEvent(uri, 'change')
      ),
      this.fileSystemWatcher.onDidCreate(uri =>
        this.handleFileEvent(uri, 'create')
      ),
      this.fileSystemWatcher.onDidDelete(uri =>
        this.handleFileEvent(uri, 'delete')
      )
    )
  }

  private handleFileEvent(
    uri: vscode.Uri,
    eventType: 'change' | 'create' | 'delete'
  ): void {
    const schemeUri = workspaceSchemeHandler.createSchemeUri({
      fullPath: uri.fsPath
    })

    if (eventType === 'delete') {
      this.indexer?.handleFileDelete(schemeUri)
    } else {
      this.indexer?.handleFileChange(schemeUri)
    }
  }

  dispose(): void {
    this.fileSystemWatcher?.dispose()
    this.indexer?.dispose()
    this.disposables.forEach(dispose => dispose.dispose())
    this.disposables = []
  }
}
