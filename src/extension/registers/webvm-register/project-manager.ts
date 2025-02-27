import { traverseFileOrFolders } from '@extension/file-utils/traverse-fs'
import { vfs } from '@extension/file-utils/vfs'
import { UriScheme } from '@extension/file-utils/vfs/helpers/types'
import { webvmSchemeHandler } from '@extension/file-utils/vfs/schemes/webvm-scheme'
import { logger } from '@extension/logger'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'
import { t } from 'i18next'

import {
  IProjectManager,
  type IFrameworkPreset,
  type IProjectConfig
} from './types'

export interface CreateWebVMProjectManagerOptions {
  projectId: string
  preset: IFrameworkPreset
}

export class WebVMProjectManager implements IProjectManager {
  private rootSchemeUri: string

  private port: number = 3000

  private preset: IFrameworkPreset

  private config: IProjectConfig = {
    name: '',
    dependencies: {},
    devDependencies: {}
  }

  private presetNameMap = new Map<string, IFrameworkPreset>()

  static async create(
    options: CreateWebVMProjectManagerOptions
  ): Promise<WebVMProjectManager> {
    const projectManager = new WebVMProjectManager(options)
    await projectManager.init()
    return projectManager
  }

  private constructor(options: CreateWebVMProjectManagerOptions) {
    const { preset, projectId } = options

    logger.log(`[Init] Using preset: ${preset.getPresetName()}`)
    this.rootSchemeUri = webvmSchemeHandler.createSchemeUri({
      projectId,
      presetName: preset.getPresetName(),
      relativePath: ''
    })

    this.preset = preset
  }

  async init(): Promise<void> {
    await vfs.ensureDir(this.rootSchemeUri)
  }

  getRootSchemeUri(): string {
    return this.rootSchemeUri
  }

  getPreset(): IFrameworkPreset {
    return this.preset
  }

  setPort(port: number): void {
    this.port = port
  }

  getPort(): number {
    return this.port
  }

  resolveWebVMSchemeUri(relativePathOrSchemeUri: string): string {
    if (vfs.isSchemeUri(relativePathOrSchemeUri)) {
      if (!relativePathOrSchemeUri.startsWith(UriScheme.WebVM))
        throw new Error(t('extension.webvm.errors.invalidWebvmUri'))
      return relativePathOrSchemeUri
    }
    return SchemeUriHelper.join(this.rootSchemeUri, relativePathOrSchemeUri)
  }

  async writeFile(
    relativePathOrSchemeUri: string,
    content: string
  ): Promise<void> {
    const schemeUri = this.resolveWebVMSchemeUri(relativePathOrSchemeUri)
    const dirPath = SchemeUriHelper.join(schemeUri, '..')

    await vfs.ensureDir(dirPath)

    await vfs.promises.writeFile(schemeUri, content, 'utf-8')
  }

  async readFile(relativePathOrSchemeUri: string): Promise<string | null> {
    try {
      const schemeUri = this.resolveWebVMSchemeUri(relativePathOrSchemeUri)
      return await vfs.promises.readFile(schemeUri, 'utf-8')
    } catch (e) {
      return null
    }
  }

  async deleteFile(relativePathOrSchemeUri: string): Promise<void> {
    const schemeUri = this.resolveWebVMSchemeUri(relativePathOrSchemeUri)
    await vfs.promises.unlink(schemeUri)
  }

  async listFiles(): Promise<string[]> {
    return await traverseFileOrFolders({
      schemeUris: [this.rootSchemeUri],
      type: 'file',
      ignorePatterns: ['**/dist/**'],
      itemCallback: item => item.schemeUri
    })
  }

  async cleanProject(): Promise<void> {
    await vfs.promises.rmdir(this.rootSchemeUri, {
      recursive: true
    })
  }

  async getConfig(): Promise<IProjectConfig> {
    try {
      const pkgContent = await this.readFile('package.json')
      if (pkgContent) {
        this.config = JSON.parse(pkgContent)
      }
    } catch (e) {
      // if do not have package.json, return default config
    }
    return { ...this.config }
  }

  async updateConfig(newConfig: Partial<IProjectConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig }
    await this.writeFile('package.json', JSON.stringify(this.config, null, 2))
  }

  dispose(): void {}
}
