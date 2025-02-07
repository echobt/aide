import crypto from 'crypto'
import path from 'path'
import { getServerState } from '@extension/state'
import { getWorkspaceFolder } from '@extension/utils'
import { toUnixPath } from '@shared/utils/common'

import { vfs } from './vfs'

export const getExt = (filePath: string): string =>
  path.extname(filePath).slice(1)

export const getSemanticHashName = (
  forSemantic: string,
  forHash?: string
): string => {
  const semanticsName = forSemantic.replace(/[^a-zA-Z0-9]/g, '_')

  if (!forHash) return semanticsName.toLowerCase()

  const hashName = crypto
    .createHash('md5')
    .update(forHash)
    .digest('hex')
    .substring(0, 8)

  return `${semanticsName}_${hashName}`.toLowerCase()
}

export class AidePaths {
  private static instance: AidePaths

  public static getInstance(): AidePaths {
    if (!AidePaths.instance) {
      AidePaths.instance = new AidePaths()
    }
    return AidePaths.instance
  }

  getAideDir() {
    const { context } = getServerState()
    if (!context) throw new Error('No context found')
    return toUnixPath(context.globalStorageUri.fsPath)
  }

  getNamespace() {
    const workspacePath = toUnixPath(getWorkspaceFolder().uri.fsPath)

    return getSemanticHashName(path.basename(workspacePath), workspacePath)
  }

  private async ensurePath(
    pathToEnsure: string,
    isDirectory: boolean
  ): Promise<string> {
    if (isDirectory) {
      await vfs.ensureDir(pathToEnsure)
    } else {
      await vfs.ensureFile(pathToEnsure)
    }
    return pathToEnsure
  }

  private async joinAideGlobalPath(
    isDirectory: boolean,
    ...segments: string[]
  ): Promise<string> {
    const fullPath = toUnixPath(path.join(this.getAideDir(), ...segments))
    return await this.ensurePath(fullPath, isDirectory)
  }

  private async joinAideNamespacePath(
    isDirectory: boolean,
    ...segments: string[]
  ): Promise<string> {
    const fullPath = toUnixPath(
      await this.joinAideGlobalPath(
        isDirectory,
        this.getNamespace(),
        ...segments
      )
    )
    return await this.ensurePath(fullPath, isDirectory)
  }

  getSessionFilePath = async (sessionId: string) =>
    await this.joinAideNamespacePath(
      false,
      'sessions',
      `session-${sessionId}.json`
    )

  getWorkspaceCheckpointDirPath = async () =>
    await this.joinAideNamespacePath(true, 'workspace-checkpoint')

  // lancedb
  getGlobalLanceDbPath = async () =>
    await this.joinAideGlobalPath(true, 'lancedb')

  getWorkspaceLanceDbPath = async () =>
    await this.joinAideNamespacePath(true, 'lancedb')

  // lowdb
  getGlobalLowdbPath = async () => await this.joinAideGlobalPath(true, 'lowdb')

  getWorkspaceLowdbPath = async () =>
    await this.joinAideNamespacePath(true, 'lowdb')

  getLogsPath = async () => await this.joinAideNamespacePath(true, 'logs')

  getDocsCrawlerPath = async () =>
    await this.joinAideGlobalPath(true, 'doc-crawler')

  getGitProjectsPath = async () => this.joinAideGlobalPath(true, 'git-projects')

  // temp
  getTempDir = async () => await this.joinAideGlobalPath(true, 'temp')
}

export const aidePaths = AidePaths.getInstance()
