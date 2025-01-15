import crypto from 'crypto'
import os from 'os'
import path from 'path'
import { vfs } from '@extension/file-utils/vfs'
import { logger } from '@extension/logger'
import { getErrorMsg } from '@shared/utils/common'
import { Mutex } from 'async-mutex'
import { glob, type GlobOptionsWithFileTypesTrue } from 'glob'
import { createFsFromVolume, Volume, type IFs } from 'memfs'

import { FileExcludeStrategy } from './file-exclude-strategy'
import { GitOperations } from './git-operations'
import { FileCheckpointOptions, FileDiff } from './types'

/**
 * Helper function to safely compare file contents
 */
async function isFileContentEqual(
  buffer1: Buffer,
  buffer2: Buffer
): Promise<boolean> {
  if (buffer1.length !== buffer2.length) return false
  return crypto.timingSafeEqual(buffer1, buffer2)
}

export class FileCheckpoint {
  private readonly mutex = new Mutex()

  private readonly excludeStrategy: FileExcludeStrategy

  private readonly gitOps: GitOperations

  private readonly memfs: IFs

  private readonly volume: InstanceType<typeof Volume>

  private readonly workingDirectory: string

  private readonly taskId: string

  private readonly storageDir: string

  private lastSyncHash = ''

  private checkpointCount = 0

  private diffCache = new Map<string, FileDiff[]>()

  private disposables: Array<() => void> = []

  private constructor(options: FileCheckpointOptions) {
    this.workingDirectory = options.workingDirectory
    this.taskId = options.taskId
    this.storageDir = options.storageDir
    this.volume = new Volume()
    this.memfs = createFsFromVolume(this.volume)
    this.gitOps = new GitOperations(this.memfs)
    this.excludeStrategy = new FileExcludeStrategy()
  }

  /**
   * Create a new FileCheckpoint instance with validation
   */
  static async create(
    workingDirectory: string,
    taskId: string,
    storageDir: string
  ): Promise<FileCheckpoint> {
    try {
      await FileCheckpoint.validateWorkingDirectory(workingDirectory)

      const checkpoint = new FileCheckpoint({
        workingDirectory,
        taskId,
        storageDir
      })
      await checkpoint.initialize()

      try {
        await checkpoint.loadFromDisk()
      } catch (error) {
        logger.warn('Failed to load checkpoint from disk:', error)
      }

      return checkpoint
    } catch (error) {
      logger.error('Failed to create checkpoint:', error)
      throw error
    }
  }

  /**
   * Validate working directory for safety
   */
  private static async validateWorkingDirectory(dir: string): Promise<void> {
    const homedir = os.homedir()
    const restrictedDirs = [
      homedir,
      path.join(homedir, 'Desktop'),
      path.join(homedir, 'Documents'),
      path.join(homedir, 'Downloads')
    ]

    if (restrictedDirs.includes(dir)) {
      throw new Error(
        `Cannot create checkpoints in ${path.basename(dir)} directory`
      )
    }

    try {
      await vfs.promises.access(dir)
    } catch {
      throw new Error(`Working directory does not exist: ${dir}`)
    }
  }

  /**
   * Initialize git repository and create initial commit
   */
  private async initialize(): Promise<void> {
    return this.safeOperation(async () => {
      await this.gitOps.init()
      await this.handleNestedGit(true)
      try {
        await this.syncWorkingDirectoryToMemory(true)
        await this.internalCreateCheckpoint('Initial commit')
      } finally {
        await this.handleNestedGit(false)
      }
    })
  }

  /**
   * Create a new checkpoint with mutex protection
   */
  async createCheckpoint(message: string = 'Checkpoint'): Promise<string> {
    return this.mutex.runExclusive(async () => {
      try {
        return await this.internalCreateCheckpoint(message)
      } catch (error) {
        logger.error('Failed to create checkpoint:', error)
        throw error
      }
    })
  }

  /**
   * Internal checkpoint creation logic
   */
  private async internalCreateCheckpoint(message: string): Promise<string> {
    return await this.safeOperation(async () => {
      await this.handleNestedGit(true)
      try {
        if (await this.hasWorkingDirectoryChanged()) {
          await this.syncWorkingDirectoryToMemory(false)
        }

        await this.gitOps.add('.')
        const commitHash = await this.gitOps.commit(message)
        await this.handlePeriodicTasks()
        return commitHash
      } finally {
        await this.handleNestedGit(false)
      }
    })
  }

  /**
   * Handle periodic maintenance tasks
   */
  private async handlePeriodicTasks(): Promise<void> {
    this.checkpointCount++
    if (this.checkpointCount % 5 === 0) {
      await this.cleanupMemory()
    }
    if (this.checkpointCount % 10 === 0) {
      await this.persistToDisk().catch(logger.error)
    }
  }

  /**
   * Restore files from a specific checkpoint
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
   * Internal restore checkpoint logic
   */
  private async internalRestoreCheckpoint(commitHash: string): Promise<void> {
    return await this.safeOperation(async () => {
      await this.handleNestedGit(true)
      try {
        await this.gitOps.checkout(commitHash)
        await this.syncMemoryToWorkingDirectory()
        this.diffCache.clear()
      } finally {
        await this.handleNestedGit(false)
      }
    })
  }

  /**
   * Get differences between commits or working directory
   */
  async getDiff(oldHash?: string, newHash?: string): Promise<FileDiff[]> {
    return this.mutex.runExclusive(async () => {
      try {
        const cacheKey = `${oldHash}-${newHash}`
        const cached = this.diffCache.get(cacheKey)
        if (cached) return cached

        if (!newHash) {
          await this.syncWorkingDirectoryToMemory(false)
        }

        const result = await this.gitOps.getDiff(oldHash, newHash)
        this.updateDiffCache(cacheKey, result)
        return result
      } catch (error) {
        logger.error('Failed to get diff:', error)
        throw error
      }
    })
  }

  /**
   * Update diff cache with size limit
   */
  private updateDiffCache(key: string, value: FileDiff[]) {
    if (this.diffCache.size >= 10) {
      const oldestKey = this.diffCache.keys().next().value
      if (oldestKey) {
        this.diffCache.delete(oldestKey)
      }
    }
    this.diffCache.set(key, value)
  }

  /**
   * Check if working directory has changed
   */
  private async hasWorkingDirectoryChanged(): Promise<boolean> {
    try {
      const files = await this.getWorkingDirectoryFiles()
      const currentHash = crypto
        .createHash('md5')
        .update(JSON.stringify(files))
        .digest('hex')

      const changed = currentHash !== this.lastSyncHash
      this.lastSyncHash = currentHash
      return changed
    } catch (error) {
      logger.error('Failed to check working directory changes:', error)
      return true
    }
  }

  /**
   * Get all tracked files in working directory
   */
  private async getWorkingDirectoryFiles(): Promise<string[]> {
    const result: string[] = []

    const scan = async (dir: string) => {
      try {
        const entries = await vfs.promises.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          const relativePath = path.relative(this.workingDirectory, fullPath)

          if (this.excludeStrategy.shouldExclude(relativePath)) {
            continue
          }

          if (entry.isDirectory()) {
            await scan(fullPath)
          } else if (entry.isFile()) {
            result.push(relativePath)
          }
        }
      } catch (error) {
        logger.error(`Failed to scan directory: ${dir}`, error)
      }
    }

    await scan(this.workingDirectory)
    return result
  }

  /**
   * Sync working directory to memory filesystem
   */
  private async syncWorkingDirectoryToMemory(
    forceFullSync: boolean
  ): Promise<void> {
    try {
      if (forceFullSync) {
        await this.volume.reset()
        await this.copyAllFilesToMemfs(this.workingDirectory, '/')
        return
      }

      const existingFiles = await this.gitOps.listFiles()
      const existingSet = new Set(existingFiles)
      const currentFiles = await this.getWorkingDirectoryFiles()
      const currentSet = new Set(currentFiles)

      // Add or update files
      for (const relativePath of currentSet) {
        if (
          !existingSet.has(relativePath) ||
          (await this.isFileChangedInMemfs(relativePath))
        ) {
          await this.writeFileToMemfs(relativePath)
        }
      }

      // Remove deleted files
      for (const relativePath of existingSet) {
        if (!currentSet.has(relativePath)) {
          const memPath = `/${relativePath.replace(/\\/g, '/')}`
          await new Promise<void>((resolve, reject) =>
            this.memfs.unlink(memPath, err => (err ? reject(err) : resolve()))
          )
        }
      }
    } catch (error) {
      logger.error('Failed to sync working directory to memory:', error)
      throw error
    }
  }

  /**
   * Sync memory filesystem to working directory
   */
  private async syncMemoryToWorkingDirectory(): Promise<void> {
    try {
      const files = await this.gitOps.listFiles()

      for (const relativePath of files) {
        const memPath = `/${relativePath.replace(/\\/g, '/')}`
        const workPath = path.join(this.workingDirectory, relativePath)

        await vfs.promises.mkdir(path.dirname(workPath), { recursive: true })
        const bufferContent = await new Promise<Buffer>((resolve, reject) =>
          this.memfs.readFile(memPath, (err, data) =>
            err
              ? reject(err)
              : resolve(
                  Buffer.isBuffer(data) ? data : Buffer.from(data as string)
                )
          )
        )
        await vfs.promises.writeFile(workPath, bufferContent)
      }

      await this.cleanWorkingDirectory(files)
    } catch (error) {
      logger.error('Failed to sync memory to working directory:', error)
      throw error
    }
  }

  /**
   * Copy all files to memory filesystem
   */
  private async copyAllFilesToMemfs(
    sourceDir: string,
    targetDir: string
  ): Promise<void> {
    try {
      const entries = await vfs.promises.readdir(sourceDir, {
        withFileTypes: true
      })

      for (const entry of entries) {
        const fullPath = path.join(sourceDir, entry.name)
        const relativePath = path.relative(this.workingDirectory, fullPath)
        const memPath = path.join(targetDir, entry.name).replace(/\\/g, '/')

        if (this.excludeStrategy.shouldExclude(relativePath)) {
          continue
        }

        if (entry.isDirectory()) {
          await new Promise<void>((resolve, reject) =>
            this.memfs.mkdir(memPath, { mode: 0o777 }, err =>
              err ? reject(err) : resolve()
            )
          )
          await this.copyAllFilesToMemfs(fullPath, memPath)
        } else if (entry.isFile()) {
          const bufferContent = await vfs.promises.readFile(fullPath)
          await new Promise<void>((resolve, reject) =>
            this.memfs.writeFile(
              memPath,
              bufferContent,
              { mode: 0o666 },
              err => (err ? reject(err) : resolve())
            )
          )
        }
      }
    } catch (error) {
      logger.error(`Failed to copy files to memfs from: ${sourceDir}`, error)
      throw error
    }
  }

  /**
   * Check if file content has changed between memory and disk
   */
  private async isFileChangedInMemfs(relativePath: string): Promise<boolean> {
    const memPath = `/${relativePath.replace(/\\/g, '/')}`
    const diskPath = path.join(this.workingDirectory, relativePath)

    try {
      const memBufferContent = await new Promise<Buffer>((resolve, reject) =>
        this.memfs.readFile(memPath, 'binary', (err, data) =>
          err ? reject(err) : resolve(Buffer.from(data as string, 'binary'))
        )
      )
      const diskBufferContent = await vfs.promises.readFile(diskPath)
      return !(await isFileContentEqual(memBufferContent, diskBufferContent))
    } catch {
      return true // Assume changed if error occurs
    }
  }

  /**
   * Write file to memory filesystem
   */
  private async writeFileToMemfs(relativePath: string): Promise<void> {
    const memPath = `/${relativePath.replace(/\\/g, '/')}`
    const diskPath = path.join(this.workingDirectory, relativePath)

    try {
      const bufferContent = await vfs.promises.readFile(diskPath, 'binary')
      await new Promise<void>((resolve, reject) =>
        this.memfs.mkdir(path.dirname(memPath), { mode: 0o777 }, err =>
          err ? reject(err) : resolve()
        )
      )
      await new Promise<void>((resolve, reject) =>
        this.memfs.writeFile(
          memPath,
          Buffer.from(bufferContent, 'binary'),
          { mode: 0o666 },
          err => (err ? reject(err) : resolve())
        )
      )
    } catch (error) {
      logger.error(`Failed to write file to memfs: ${relativePath}`, error)
      throw error
    }
  }

  /**
   * Clean working directory by removing untracked files
   */
  private async cleanWorkingDirectory(versionFiles: string[]): Promise<void> {
    const normalizedVersionFiles = new Set(
      versionFiles.map(f => f.replace(/\\/g, '/'))
    )

    const scan = async (dir: string) => {
      const entries = await vfs.promises.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relativePath = path.relative(this.workingDirectory, fullPath)

        if (this.excludeStrategy.shouldExclude(relativePath)) {
          continue
        }

        if (entry.isDirectory()) {
          await scan(fullPath)
          try {
            const remainingFiles = await vfs.promises.readdir(fullPath)
            if (remainingFiles.length === 0) {
              await vfs.promises.rmdir(fullPath)
            }
          } catch (error) {
            logger.error(`Failed to clean directory: ${fullPath}`, error)
          }
        } else if (entry.isFile()) {
          const normalizedPath = relativePath.replace(/\\/g, '/')
          if (!normalizedVersionFiles.has(normalizedPath)) {
            try {
              await vfs.promises.unlink(fullPath)
            } catch (error) {
              logger.error(`Failed to remove file: ${fullPath}`, error)
            }
          }
        }
      }
    }

    await scan(this.workingDirectory)
  }

  /**
   * Handle nested git repositories
   */
  private async handleNestedGit(disable: boolean) {
    try {
      const gitPaths = await glob(`**/.git${disable ? '' : '_disabled'}`, {
        cwd: this.workingDirectory,
        nodir: false,
        ignore: ['.git'],
        dot: true
      } as GlobOptionsWithFileTypesTrue)

      for (const gitPath of gitPaths) {
        const fullPath = path.join(this.workingDirectory, gitPath.toString())
        const newPath = disable
          ? `${fullPath}_disabled`
          : fullPath.replace(/_disabled$/, '')

        try {
          await vfs.promises.rename(fullPath, newPath)
        } catch (error) {
          logger.error(
            `Failed to ${disable ? 'disable' : 'enable'} nested git: ${gitPath}`,
            error
          )
        }
      }
    } catch (error) {
      logger.error('Failed to handle nested git repositories:', error)
    }
  }

  /**
   * Clean up memory and perform git garbage collection
   */
  private async cleanupMemory() {
    try {
      await this.volume.reset()
      await this.copyAllFilesToMemfs(this.workingDirectory, '/')
    } catch (error) {
      logger.error('Failed to cleanup memory:', error)
      throw error
    }
  }

  /**
   * Perform operation with error recovery
   */
  private async safeOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      logger.error('Operation failed, attempting recovery:', error)

      try {
        await this.volume.reset()
        await this.copyAllFilesToMemfs(this.workingDirectory, '/')
        return await operation()
      } catch (retryError) {
        logger.error('Recovery failed:', retryError)
        throw new Error(
          `Operation failed and could not be recovered: ${getErrorMsg(retryError)}`
        )
      }
    }
  }

  /**
   * Persist memory filesystem state to disk
   */
  async persistToDisk(): Promise<void> {
    try {
      const gitDir = path.join(this.storageDir, 'tasks', this.taskId, 'git')
      await vfs.promises.mkdir(gitDir, { recursive: true })

      const serialized = this.volume.toJSON()
      await vfs.promises.writeFile(
        path.join(gitDir, 'fs.json'),
        Buffer.from(JSON.stringify(serialized, null, 2))
      )
    } catch (error) {
      logger.error('Failed to persist to disk:', error)
      throw error
    }
  }

  /**
   * Load memory filesystem state from disk
   */
  async loadFromDisk(): Promise<void> {
    const gitDir = path.join(this.storageDir, 'tasks', this.taskId, 'git')
    const fsPath = path.join(gitDir, 'fs.json')

    if (await vfs.isFileExists(fsPath)) {
      try {
        const serialized = JSON.parse(
          await vfs.promises.readFile(fsPath, 'utf-8')
        )
        this.volume.fromJSON(serialized)
      } catch (error) {
        logger.error('Failed to load from disk:', error)
        throw error
      }
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    try {
      this.disposables.forEach(d => d())
      this.disposables = []
      this.diffCache.clear()
      this.volume.reset()
    } catch (error) {
      logger.error('Failed to dispose checkpoint:', error)
    }
  }
}
