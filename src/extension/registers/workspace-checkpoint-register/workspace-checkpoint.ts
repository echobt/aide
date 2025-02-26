import crypto from 'crypto'
import os from 'os'
import path from 'path'
import { DEFAULT_IGNORE_FILETYPES } from '@extension/constants'
import { aidePaths } from '@extension/file-utils/paths'
import { traverseFileOrFolders } from '@extension/file-utils/traverse-fs'
import { vfs } from '@extension/file-utils/vfs'
import { logger } from '@extension/logger'
import {
  getErrorMsg,
  settledPromiseResults,
  toUnixPath
} from '@shared/utils/common'
import { Mutex } from 'async-mutex'
import { t } from 'i18next'

import { GitOperations } from './git-operations'

export interface FileDiff {
  relativePath: string
  absolutePath: string
  before: string
  after: string
}

/**
 * safe compare two buffer content
 */
const isFileContentEqual = async (
  buffer1: Buffer,
  buffer2: Buffer
): Promise<boolean> => {
  if (buffer1.length !== buffer2.length) return false
  return crypto.timingSafeEqual(buffer1, buffer2)
}

/**
 * workspace checkpoint class, for save working directory file state and restore at any time
 */
export class WorkspaceCheckpoint {
  private workingDirectory: string

  private gitOps!: GitOperations

  private diffCache: Map<string, FileDiff[]> = new Map()

  private disposables: Array<() => void> = []

  private mutex = new Mutex()

  private ignorePatterns: string[] = [
    // Git related
    '.git',
    '**/.git',
    ...DEFAULT_IGNORE_FILETYPES
  ]

  private memDirPath!: string

  private constructor(workingDirectory: string) {
    this.workingDirectory = toUnixPath(workingDirectory)
  }

  /**
   * create workspace checkpoint instance and complete necessary initialization and data loading
   */
  static async create(workingDirectory: string): Promise<WorkspaceCheckpoint> {
    await WorkspaceCheckpoint.validateWorkingDirectory(workingDirectory)
    const checkpoint = new WorkspaceCheckpoint(workingDirectory)
    await checkpoint.initialize()

    return checkpoint
  }

  /**
   * validate working directory safety (avoid creating in desktop, documents, downloads, etc.)
   */
  private static async validateWorkingDirectory(dir: string): Promise<void> {
    const workingDir = toUnixPath(dir)
    const homedir = toUnixPath(os.homedir())
    const restrictedDirs = [
      homedir,
      toUnixPath(path.join(homedir, 'Desktop')),
      toUnixPath(path.join(homedir, 'Documents')),
      toUnixPath(path.join(homedir, 'Downloads'))
    ]
    if (restrictedDirs.includes(workingDir)) {
      throw new Error(
        t('extension.workspaceCheckpoint.errors.restrictedDirectory', {
          directory: path.basename(workingDir)
        })
      )
    }
    try {
      await vfs.promises.access(workingDir)
    } catch {
      throw new Error(
        t('extension.workspaceCheckpoint.errors.directoryNotExist', {
          directory: workingDir
        })
      )
    }
  }

  /**
   * initialize: initialize git repository, disable nested git, full sync files and create initial commit
   */
  private async initialize(): Promise<void> {
    this.memDirPath = await aidePaths.getWorkspaceCheckpointDirPath()
    this.gitOps = new GitOperations(vfs, this.memDirPath)

    await this.safeOperation(async () => {
      const entries = await vfs.promises.readdir(this.memDirPath)
      if (entries.length === 0) {
        await this.internalCreateCheckpoint(
          t('extension.agentActions.checkpoint.initial'),
          true
        )
      }
    })
  }

  /**
   * create new checkpoint (with lock operation, prevent concurrent conflicts)
   */
  async createCheckpoint(
    message: string = t('extension.agentActions.checkpoint')
  ): Promise<string> {
    return this.mutex.runExclusive(async () => {
      try {
        return await this.internalCreateCheckpoint(message)
      } catch (error) {
        logger.error(
          t('extension.workspaceCheckpoint.errors.createFailed'),
          error
        )
        throw error
      }
    })
  }

  /**
   * internal create checkpoint logic
   */
  private async internalCreateCheckpoint(
    message: string,
    isFirstCommit = false
  ): Promise<string> {
    return await this.safeOperation(async () => {
      if (isFirstCommit) {
        await this.syncWorkingDirectoryToMemory(true)
        await this.gitOps.init()
      } else {
        await this.gitOps.addAllAndCommit('Save changes')
        await this.syncWorkingDirectoryToMemory(false)
      }
      const commitHash = await this.gitOps.addAllAndCommit(message)
      return commitHash
    })
  }

  /**
   * restore specified checkpoint
   */
  async restoreCheckpoint(commitHash: string): Promise<void> {
    return this.mutex.runExclusive(async () => {
      try {
        await this.internalRestoreCheckpoint(commitHash)
      } catch (error) {
        logger.error('Failed to restore checkpoint:', error)
        throw error
      }
    })
  }

  /**
   * internal restore checkpoint logic
   */
  private async internalRestoreCheckpoint(commitHash: string): Promise<void> {
    return this.safeOperation(async () => {
      await this.gitOps.checkout(commitHash)
      await this.syncMemoryToWorkingDirectory()
      this.diffCache.clear()
    })
  }

  /**
   * get file diff (support cache, max cache 10 diff results)
   */
  async getDiff(oldHash = 'HEAD~1', newHash = 'HEAD'): Promise<FileDiff[]> {
    return this.mutex.runExclusive(async () => {
      const cacheKey = `${oldHash}-${newHash}`
      const cached = this.diffCache.get(cacheKey)
      if (cached) return cached
      const diffs = await this.gitOps.getDiff(oldHash, newHash)
      // complete absolute path
      diffs.forEach(diff => {
        diff.absolutePath = toUnixPath(
          path.join(this.workingDirectory, diff.relativePath)
        )
      })
      this.updateDiffCache(cacheKey, diffs)
      return diffs
    })
  }

  private updateDiffCache(key: string, value: FileDiff[]): void {
    if (this.diffCache.size >= 10) {
      const oldestKey = this.diffCache.keys().next().value
      if (oldestKey) {
        this.diffCache.delete(oldestKey)
      }
    }
    this.diffCache.set(key, value)
  }

  /**
   * get all files need to track in working directory (recursive scan and apply exclude strategy)
   */
  private async getWorkingDirectoryFiles(): Promise<string[]> {
    return await traverseFileOrFolders({
      schemeUris: [await vfs.fixSchemeUri(this.workingDirectory)],
      type: 'file',
      ignorePatterns: this.ignorePatterns,
      isGetFileContent: false,
      itemCallback: item => vfs.resolveRelativePathProSync(item.schemeUri)
    })
  }

  private getMemFsFullPath(relativePath: string): string {
    return toUnixPath(path.join(this.memDirPath, relativePath))
  }

  /**
   * sync working directory files to memory file system
   */
  private async syncWorkingDirectoryToMemory(
    forceFullSync: boolean
  ): Promise<void> {
    try {
      if (forceFullSync) {
        await vfs.promises.rmdir(this.memDirPath, {
          recursive: true
        })
        await this.copyAllFilesToMemfs(this.workingDirectory)
        return
      }
      const existingFiles = await this.gitOps.listFiles()
      const existingSet = new Set(existingFiles)
      const currentFiles = await this.getWorkingDirectoryFiles()
      const currentSet = new Set(currentFiles)

      await settledPromiseResults(
        [...currentSet].map(async relativePath => {
          if (
            !existingSet.has(relativePath) ||
            !(await this.isFileEqual(relativePath))
          ) {
            await this.writeFileToMemfs(relativePath)
          }
        })
      )

      // delete deleted file
      await settledPromiseResults(
        [...existingSet].map(async relativePath => {
          if (!currentSet.has(relativePath)) {
            await vfs.promises.unlink(await this.getMemFsFullPath(relativePath))
          }
        })
      )
    } catch (error) {
      logger.error('Failed to sync working directory to memory:', error)
      throw error
    }
  }

  /**
   * sync memory file system content back to working directory
   */
  private async syncMemoryToWorkingDirectory(): Promise<void> {
    try {
      const fileRelativePaths = await this.gitOps.listFiles()
      await settledPromiseResults(
        fileRelativePaths.map(async relativePath => {
          if (await this.isFileEqual(relativePath)) return

          const workPath = toUnixPath(
            path.join(this.workingDirectory, relativePath)
          )
          const workDir = toUnixPath(path.dirname(workPath))

          if (!(await vfs.isExists(workDir))) {
            await vfs.promises.mkdir(workDir, { recursive: true })
          }

          await vfs.promises.writeFile(
            workPath,
            await vfs.promises.readFile(
              await this.getMemFsFullPath(relativePath)
            )
          )
        })
      )
      await this.cleanWorkingDirectory(fileRelativePaths)
    } catch (error) {
      logger.error('Failed to sync memory to working directory:', error)
      throw error
    }
  }

  /**
   * recursive copy all files from specified directory to memory file system
   */
  private async copyAllFilesToMemfs(sourceDir: string): Promise<void> {
    try {
      await traverseFileOrFolders({
        schemeUris: [await vfs.fixSchemeUri(sourceDir)],
        type: 'fileOrFolder',
        ignorePatterns: this.ignorePatterns,
        isGetFileContent: false,
        itemCallback: async item => {
          const relativePath = vfs.resolveRelativePathProSync(item.schemeUri)
          const memPath = this.getMemFsFullPath(relativePath)

          if (item.type === 'folder') {
            if (!(await vfs.isExists(memPath))) {
              await vfs.promises.mkdir(memPath, {
                mode: 0o777,
                recursive: true
              })
            }
          } else if (item.type === 'file') {
            const content = await vfs.promises.readFile(item.schemeUri)
            const dir = toUnixPath(path.dirname(memPath))

            if (!(await vfs.isExists(dir))) {
              await vfs.promises.mkdir(dir, {
                mode: 0o777,
                recursive: true
              })
            }

            await vfs.promises.writeFile(memPath, content, {
              mode: 0o666
            })
          }
        }
      })
    } catch (error) {
      logger.error(`Failed to copy files to memfs from: ${sourceDir}`, error)
      throw error
    }
  }

  /**
   * judge if file content in memory file system is equal to disk
   */
  private async isFileEqual(relativePath: string): Promise<boolean> {
    const memPath = await this.getMemFsFullPath(relativePath)
    const diskPath = toUnixPath(path.join(this.workingDirectory, relativePath))
    try {
      const memStat = await vfs.promises.stat(memPath)
      const diskStat = await vfs.promises.stat(diskPath)

      if (memStat.size === diskStat.size) {
        // if file size is same, then content is same (most case)
        return true
      }

      let memContent = await vfs.promises.readFile(memPath)
      memContent = Buffer.isBuffer(memContent)
        ? memContent
        : Buffer.from(memContent as string)
      const diskContent = await vfs.promises.readFile(diskPath)
      return await isFileContentEqual(memContent, diskContent)
    } catch {
      return false
    }
  }

  /**
   * write specified file to memory file system
   */
  private async writeFileToMemfs(relativePath: string): Promise<void> {
    const memPath = await this.getMemFsFullPath(relativePath)
    const diskPath = toUnixPath(path.join(this.workingDirectory, relativePath))
    try {
      const content = await vfs.promises.readFile(diskPath)
      const memDir = path.dirname(memPath)
      if (!(await vfs.isExists(memDir))) {
        await vfs.promises.mkdir(memDir, {
          mode: 0o777,
          recursive: true
        })
      }
      await vfs.promises.writeFile(memPath, content, { mode: 0o666 })
    } catch (error) {
      logger.error(`Failed to write file to memfs: ${relativePath}`, error)
      throw error
    }
  }

  /**
   * clean working directory: remove files not managed by version
   */
  private async cleanWorkingDirectory(
    versionFileRelativePaths: string[]
  ): Promise<void> {
    const normalizedVersionFileRelativePaths = new Set(
      versionFileRelativePaths.map(f => toUnixPath(f))
    )
    await traverseFileOrFolders({
      schemeUris: [await vfs.fixSchemeUri(this.workingDirectory)],
      type: 'fileOrFolder',
      ignorePatterns: this.ignorePatterns,
      isGetFileContent: false,
      itemCallback: async item => {
        try {
          if (item.type === 'folder') {
            const remainingFiles = await vfs.promises.readdir(item.schemeUri)
            if (remainingFiles.length === 0) {
              await vfs.promises.rmdir(item.schemeUri)
            }
          } else if (item.type === 'file') {
            const normalizedRelativePath = vfs.resolveRelativePathProSync(
              item.schemeUri
            )
            if (
              !normalizedVersionFileRelativePaths.has(normalizedRelativePath)
            ) {
              await vfs.promises.unlink(item.schemeUri)
            }
          }
        } catch (error) {
          logger.error(
            `Failed to clean working directory: ${item.schemeUri}`,
            error
          )
        }
      }
    })
  }

  /**
   * cleanup memory: reset memory file system and re-copy working directory files
   */
  async cleanupMemory(): Promise<void> {
    try {
      await vfs.promises.rmdir(this.memDirPath, {
        recursive: true
      })
      await this.copyAllFilesToMemfs(this.workingDirectory)
    } catch (error) {
      logger.error('Failed to cleanup memory:', error)
      throw error
    }
  }

  /**
   * safe operation wrapper: if operation failed, try reset and recover then retry
   */
  private async safeOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      logger.error('Operation failed, attempting recovery:', error)
      try {
        await this.copyAllFilesToMemfs(this.workingDirectory)
        return await operation()
      } catch (retryError) {
        logger.error('Recovery failed:', retryError)
        throw new Error(
          t('extension.workspaceCheckpoint.errors.operationAndRecoveryFailed', {
            error: getErrorMsg(retryError)
          })
        )
      }
    }
  }

  /**
   * dispose resources
   */
  dispose(): void {
    try {
      this.disposables.forEach(d => d())
      this.disposables = []
      this.diffCache.clear()
    } catch (error) {
      logger.error('Failed to dispose checkpoint:', error)
    }
  }
}
