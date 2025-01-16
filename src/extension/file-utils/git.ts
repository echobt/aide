import { exec } from 'child_process'
import { promisify } from 'util'
import { globalSettingsDB } from '@extension/lowdb/settings-db'
import simpleGit, { SimpleGit } from 'simple-git'

const execAsync = promisify(exec)

const which = async (command: string): Promise<string | null> => {
  try {
    const { stdout } = await execAsync(
      process.platform === 'win32' ? `where ${command}` : `which ${command}`
    )
    const path = stdout.trim().split('\n')[0]
    return path || null
  } catch {
    return null
  }
}

class GitUtils {
  private static instance: GitUtils

  private cachedGitPath: string | null = null

  static getInstance(): GitUtils {
    if (!GitUtils.instance) {
      GitUtils.instance = new GitUtils()
    }
    return GitUtils.instance
  }

  private async findGitExecutable(): Promise<string> {
    // Try to get from settings first
    const customPath = await globalSettingsDB.getSetting('gitExecutablePath')
    if (customPath) {
      if (!(await this.validateGitPath(customPath)))
        throw new Error('Invalid git executable path')
      return customPath
    }

    // Auto detect
    const gitPath = await which('git')
    if (!gitPath) {
      throw new Error(
        'Git executable not found. Please install git or set custom path in settings.'
      )
    }
    if (!(await this.validateGitPath(gitPath))) {
      throw new Error('Invalid git executable path')
    }

    return gitPath
  }

  async getGitPath(): Promise<string> {
    if (!this.cachedGitPath) {
      this.cachedGitPath = await this.findGitExecutable()
    }
    return this.cachedGitPath
  }

  async validateGitPath(path: string): Promise<boolean> {
    try {
      const git = simpleGit({ binary: path })
      await git.version()
      return true
    } catch {
      return false
    }
  }

  async createGit(cwd?: string): Promise<SimpleGit> {
    const gitPath = await this.getGitPath()
    return simpleGit({
      binary: gitPath,
      ...(cwd ? { baseDir: cwd } : {})
    })
  }

  clearCache() {
    this.cachedGitPath = null
  }
}

export const gitUtils = GitUtils.getInstance()
