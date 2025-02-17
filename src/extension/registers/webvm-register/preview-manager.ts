import { vfs } from '@extension/file-utils/vfs'
import { logger } from '@extension/logger'
import { getErrorMsg } from '@shared/utils/common'
import findFreePorts from 'find-free-ports'
import { createServer, type ViteDevServer } from 'vite'

import { mergeWithBaseViteConfig } from './presets/_base/base-vite-config'
import { IPreviewManager, type IProjectManager, type ViteConfig } from './types'

export class WebVMPreviewManager2 implements IPreviewManager {
  private devServer: ViteDevServer | null = null

  private serverErrors: string[] = []

  constructor(private projectManager: IProjectManager) {}

  private async startPreviewServerInternal(): Promise<void> {
    await this.stopPreviewServer()
    const processedViteConfig = await this.getProcessedViteConfig()

    // start dev server
    this.devServer = await createServer(processedViteConfig)
    await this.devServer.listen()

    // handle server errors
    this.devServer.httpServer?.on('error', err => {
      const errMsg = getErrorMsg(err)
      this.serverErrors.push(errMsg)
      logger.error(`[Preview] Server error: ${errMsg}`)
    })

    logger.log(`[Preview] Dev server available at: ${this.getPreviewUrl()}`)
  }

  async startPreviewServer(): Promise<void> {
    try {
      await this.startPreviewServerInternal()
    } catch (err) {
      logger.warn('[Preview] First attempt failed, retrying once...')
      try {
        await this.startPreviewServerInternal()
      } catch (retryErr) {
        const errMsg = getErrorMsg(retryErr)
        this.serverErrors.push(errMsg)
        logger.error(`[Preview] Failed to start server after retry: ${errMsg}`)
        throw retryErr
      }
    }
  }

  async stopPreviewServer(): Promise<void> {
    if (this.devServer) {
      try {
        logger.log(`[Preview] Stopping server at: ${this.getPreviewUrl()}`)
        await this.devServer.close()
      } catch (err) {
        logger.error(`[Preview] Error stopping server`, err)
      } finally {
        this.serverErrors = []
        this.devServer = null
      }
    }
  }

  async getProcessedViteConfig(): Promise<ViteConfig> {
    const rootSchemeUri = this.projectManager.getRootSchemeUri()
    const rootDir = await vfs.resolveFullPathProAsync(rootSchemeUri, false)
    const preset = this.projectManager.getPreset()
    const viteConfig = preset.getViteConfig(rootDir)
    const freePorts = await findFreePorts.findFreePorts(1, {
      startPort: 3001,
      endPort: 7999
    })

    if (!freePorts.length) throw new Error('No free ports found')

    const mergedViteConfig = mergeWithBaseViteConfig(viteConfig, {
      rootDir,
      port: freePorts[0]!,
      isKnownDeps: preset.isKnownDeps,
      processUnknownDepsLink: preset.processUnknownDepsLink
    })

    return mergedViteConfig
  }

  getPreviewUrl(): string {
    if (!this.devServer) {
      return ''
    }
    const address = this.devServer.httpServer?.address()
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
    return this.devServer !== null
  }

  async dispose(): Promise<void> {
    await this.stopPreviewServer()
  }
}
