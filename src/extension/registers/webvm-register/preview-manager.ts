import { vfs } from '@extension/file-utils/vfs'
import { logger } from '@extension/logger'
import { getErrorMsg } from '@shared/utils/common'
import { build, preview, type PreviewServer } from 'vite'

import { mergeWithBaseViteConfig } from './presets/base-vite-config'
import { IPreviewManager, type IProjectManager, type ViteConfig } from './types'

export class WebVMPreviewManager implements IPreviewManager {
  private previewServer: PreviewServer | null = null

  private serverErrors: string[] = []

  constructor(private projectManager: IProjectManager) {}

  async startPreviewServer(): Promise<void> {
    try {
      await this.stopPreviewServer()
      const processedViteConfig = await this.getProcessedViteConfig()

      // build first
      await build(processedViteConfig)
      logger.log('[Preview] Build completed')

      // start preview server
      this.previewServer = await preview(processedViteConfig)

      // handle server errors
      this.previewServer.httpServer?.on('error', err => {
        const errMsg = getErrorMsg(err)
        this.serverErrors.push(errMsg)
        logger.error(`[Preview] Server error: ${errMsg}`)
      })

      logger.log(`[Preview] Available at: ${this.getPreviewUrl()}`)
    } catch (err) {
      const errMsg = getErrorMsg(err)
      this.serverErrors.push(errMsg)
      logger.error(`[Preview] Failed to start server: ${errMsg}`)
      throw err
    }
  }

  async stopPreviewServer(): Promise<void> {
    if (this.previewServer) {
      try {
        logger.log(`[Preview] Stopping server at: ${this.getPreviewUrl()}`)
        await this.previewServer.httpServer?.close()
      } catch (err) {
        logger.error(`[Preview] Error stopping server`, err)
      } finally {
        this.serverErrors = []
        this.previewServer = null
      }
    }
  }

  async getProcessedViteConfig(): Promise<ViteConfig> {
    const rootSchemeUri = this.projectManager.getRootSchemeUri()
    const rootDir = await vfs.resolveFullPathProAsync(rootSchemeUri, false)
    const preset = this.projectManager.getPreset()
    const viteConfig = preset.getViteConfig(rootDir)
    const mergedViteConfig = mergeWithBaseViteConfig(viteConfig, {
      rootDir,
      isKnownDeps: preset.isKnownDeps,
      processUnknownDepsLink: preset.processUnknownDepsLink
    })

    return mergedViteConfig
  }

  getPreviewUrl(): string {
    const address = this.previewServer?.httpServer?.address()
    if (!address) {
      return ''
    }
    if (typeof address === 'string') {
      return address
    }
    return `http://${address.address}:${address.port}`
  }

  getServerErrors(): string[] {
    return this.serverErrors
  }

  getIsPreviewServerRunning(): boolean {
    return this.previewServer !== null
  }

  async dispose(): Promise<void> {
    await this.stopPreviewServer()
  }
}
