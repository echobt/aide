import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { vfs } from '@extension/file-utils/vfs'
import { logger } from '@extension/logger'
import { getErrorMsg } from '@shared/utils/common'
import { Mutex } from 'async-mutex'
import { glob, type GlobOptionsWithFileTypesTrue } from 'glob'
import * as git from 'isomorphic-git'
import { createFsFromVolume, Volume, type IFs } from 'memfs'

/**
 * Interface for file differences between commits
 */
interface FileDiff {
  relativePath: string
  absolutePath: string
  before: string
  after: string
}

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

// Mutex for ensuring exclusive operations
const operationMutex = new Mutex()

export class FileCheckpoint {
  private workingDirectory: string

  private taskId: string

  private storageDir: string

  private volume: InstanceType<typeof Volume>

  private memfs: IFs

  private lastSyncHash: string = ''

  private checkpointCount: number = 0

  private diffCache: Map<string, FileDiff[]> = new Map()

  private disposables: Array<() => void> = []

  // Pre-compiled exclude patterns
  private excludeRegexes: RegExp[]

  private constructor(
    workingDirectory: string,
    taskId: string,
    storageDir: string
  ) {
    this.workingDirectory = workingDirectory
    this.taskId = taskId
    this.storageDir = storageDir
    this.volume = new Volume()
    this.memfs = createFsFromVolume(this.volume)

    // Convert exclude patterns to RegExp
    this.excludeRegexes = this.excludePatterns.map(pattern => {
      const escaped = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')
      return new RegExp(`^${escaped}$`)
    })
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

      const checkpoint = new FileCheckpoint(
        workingDirectory,
        taskId,
        storageDir
      )
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
      await fs.access(dir)
    } catch {
      throw new Error(`Working directory does not exist: ${dir}`)
    }
  }

  /**
   * Initialize git repository in memory and create initial commit
   */
  private async initialize(): Promise<void> {
    await this.safeOperation(async () => {
      // Initialize git repository
      await git.init({
        fs: this.memfs,
        dir: '/',
        defaultBranch: 'main'
      })

      // Configure git
      await git.setConfig({
        fs: this.memfs,
        dir: '/',
        path: 'user.name',
        value: 'File Checkpoint'
      })
      await git.setConfig({
        fs: this.memfs,
        dir: '/',
        path: 'user.email',
        value: 'noreply@example.com'
      })

      // Handle nested git repositories
      await this.handleNestedGit(true)
      try {
        // Initial sync and commit
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
    return operationMutex.runExclusive(async () => {
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
        // Sync if working directory has changes
        if (await this.hasWorkingDirectoryChanged()) {
          await this.syncWorkingDirectoryToMemory(false)
        }

        // Stage changes
        await git.add({
          fs: this.memfs,
          dir: '/',
          filepath: '.'
        })

        // Create commit
        const commitHash = await git.commit({
          fs: this.memfs,
          dir: '/',
          message,
          author: {
            name: 'File Checkpoint',
            email: 'noreply@example.com'
          }
        })

        this.checkpointCount++

        // Periodic maintenance
        if (this.checkpointCount % 5 === 0) {
          await this.cleanupMemory()
        }

        // Periodic persistence
        if (this.checkpointCount % 10 === 0) {
          await this.persistToDisk().catch(logger.error)
        }

        return commitHash
      } finally {
        await this.handleNestedGit(false)
      }
    })
  }

  /**
   * Restore files from a specific checkpoint
   */
  async restoreCheckpoint(commitHash: string): Promise<void> {
    return operationMutex.runExclusive(async () => {
      try {
        return await this.internalRestoreCheckpoint(commitHash)
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
        // Checkout specified commit
        await git.checkout({
          fs: this.memfs,
          dir: '/',
          ref: commitHash,
          force: true
        })

        // Sync memory state to working directory
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
    return operationMutex.runExclusive(async () => {
      try {
        const cacheKey = `${oldHash}-${newHash}`
        const cached = this.diffCache.get(cacheKey)
        if (cached) return cached

        const result = await this.internalGetDiff(oldHash, newHash)
        this.updateDiffCache(cacheKey, result)
        return result
      } catch (error) {
        logger.error('Failed to get diff:', error)
        throw error
      }
    })
  }

  /**
   * Internal diff computation logic
   */
  private async internalGetDiff(
    oldHash?: string,
    newHash?: string
  ): Promise<FileDiff[]> {
    return await this.safeOperation(async () => {
      // Use first commit if oldHash not provided
      if (!oldHash) {
        const commits = await git.log({ fs: this.memfs, dir: '/' })
        oldHash = commits[commits.length - 1]!.oid
      }

      // Sync working directory if comparing against it
      if (!newHash) {
        await this.syncWorkingDirectoryToMemory(false)
      }

      const diffs = await git.walk({
        fs: this.memfs,
        dir: '/',
        trees: [
          git.TREE({ ref: oldHash }),
          newHash ? git.TREE({ ref: newHash }) : git.WORKDIR()
        ],
        map: async (filepath, [oldWalker, newWalker]) => {
          if (!oldWalker || !newWalker) return
          const oldContent = await oldWalker.oid()
          const newContent = await newWalker.oid()

          if (!oldContent && !newContent) return
          if (oldContent === newContent) return

          const getContent = async (walker: git.WalkerEntry | null) => {
            if (!walker) return ''
            const entry = await walker
            return entry ? Buffer.from(entry.toString()).toString('utf-8') : ''
          }

          return {
            relativePath: filepath,
            absolutePath: path.join(this.workingDirectory, filepath),
            before: await getContent(oldWalker),
            after: await getContent(newWalker)
          }
        }
      })

      return diffs.filter(Boolean) as FileDiff[]
    })
  }

  /**
   * File patterns to exclude from tracking
   */
  private readonly excludePatterns = [
    // Git related
    '.git/',
    '.git_disabled/',
    // System files
    '.DS_Store',
    // Dependencies and build
    'node_modules/',
    '__pycache__/',
    'env/',
    'venv/',
    'target/dependency/',
    'build/',
    'dist/',
    'out/',
    'bundle/',
    'vendor/',
    // Temporary
    'tmp/',
    'temp/',
    'deps/',
    // Media files
    '*.jpg',
    '*.jpeg',
    '*.png',
    '*.gif',
    '*.mp3',
    '*.mp4',
    '*.wav',
    // IDE
    '.idea/',
    '.vscode/',
    '.vs/',
    // Cache files
    '*.cache',
    '*.tmp',
    '*.swp',
    '*.pyc',
    // Environment files
    '.env*',
    '*.local',
    // Archives and binaries
    '*.zip',
    '*.tar',
    '*.gz',
    '*.exe',
    '*.dll',
    // Database files
    '*.db',
    '*.sqlite'
  ]

  /**
   * Check if a file should be excluded from tracking
   */
  private shouldExclude(relativePath: string): boolean {
    return this.excludeRegexes.some(regex => regex.test(relativePath))
  }

  /**
   * Update diff cache with size limit
   */
  private updateDiffCache(key: string, value: FileDiff[]) {
    if (this.diffCache.size >= 10) {
      const oldestKey = this.diffCache.keys().next().value
      if (!oldestKey) return
      this.diffCache.delete(oldestKey)
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
      return true // Assume changed on error
    }
  }

  /**
   * Get all tracked files in working directory
   */
  private async getWorkingDirectoryFiles(): Promise<string[]> {
    const result: string[] = []

    const scan = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          const relativePath = path.relative(this.workingDirectory, fullPath)

          if (this.shouldExclude(relativePath)) {
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

      const existingFiles = await git.listFiles({ fs: this.memfs, dir: '/' })
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
          try {
            await new Promise<void>((resolve, reject) =>
              this.memfs.unlink(memPath, err => (err ? reject(err) : resolve()))
            )
          } catch (error) {
            logger.error(`Failed to remove file from memfs: ${memPath}`, error)
          }
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
      const files = await git.listFiles({
        fs: this.memfs,
        dir: '/'
      })

      for (const relativePath of files) {
        const memPath = `/${relativePath.replace(/\\/g, '/')}`
        const workPath = path.join(this.workingDirectory, relativePath)

        await fs.mkdir(path.dirname(workPath), { recursive: true })
        const content = await new Promise<Buffer>((resolve, reject) =>
          this.memfs.readFile(memPath, (err, data) =>
            err
              ? reject(err)
              : resolve(
                  Buffer.isBuffer(data) ? data : Buffer.from(data as string)
                )
          )
        )
        await fs.writeFile(workPath, content)
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
      const entries = await fs.readdir(sourceDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(sourceDir, entry.name)
        const relativePath = path.relative(this.workingDirectory, fullPath)
        const memPath = path.join(targetDir, entry.name).replace(/\\/g, '/')

        if (this.shouldExclude(relativePath)) {
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
          const content = await fs.readFile(fullPath)
          await new Promise<void>((resolve, reject) =>
            this.memfs.writeFile(memPath, content, { mode: 0o666 }, err =>
              err ? reject(err) : resolve()
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
      const memContent = await new Promise<Buffer>((resolve, reject) =>
        this.memfs.readFile(memPath, 'binary', (err, data) =>
          err ? reject(err) : resolve(Buffer.from(data as string, 'binary'))
        )
      )
      const diskContent = await fs.readFile(diskPath)
      return !(await isFileContentEqual(memContent, diskContent))
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
      const content = await fs.readFile(diskPath)
      await new Promise<void>((resolve, reject) =>
        this.memfs.mkdir(path.dirname(memPath), { mode: 0o777 }, err =>
          err ? reject(err) : resolve()
        )
      )
      await new Promise<void>((resolve, reject) =>
        this.memfs.writeFile(memPath, content, { mode: 0o666 }, err =>
          err ? reject(err) : resolve()
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
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relativePath = path.relative(this.workingDirectory, fullPath)

        if (this.shouldExclude(relativePath)) {
          continue
        }

        if (entry.isDirectory()) {
          await scan(fullPath)
          try {
            const remainingFiles = await fs.readdir(fullPath)
            if (remainingFiles.length === 0) {
              await fs.rmdir(fullPath)
            }
          } catch (error) {
            logger.error(`Failed to clean directory: ${fullPath}`, error)
          }
        } else if (entry.isFile()) {
          const normalizedPath = relativePath.replace(/\\/g, '/')
          if (!normalizedVersionFiles.has(normalizedPath)) {
            try {
              await fs.unlink(fullPath)
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
          await fs.rename(fullPath, newPath)
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
      // Reset the volume and reload files instead of running git gc
      this.volume.reset()
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
        // Reset the volume and reload files instead of running git fsck
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
      await fs.mkdir(gitDir, { recursive: true })

      const serialized = this.volume.toJSON()
      await fs.writeFile(
        path.join(gitDir, 'fs.json'),
        JSON.stringify(serialized, null, 2)
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
