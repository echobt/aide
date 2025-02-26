import { logger } from '@extension/logger'
import { settledPromiseResults } from '@shared/utils/common'
import { t } from 'i18next'

import { WebVMPreviewManager2 } from './preview-manager'
import {
  WebVMProjectManager,
  type CreateWebVMProjectManagerOptions
} from './project-manager'
import {
  IPreviewManager,
  IProjectManager,
  WebVMStatus,
  type WebVMFiles
} from './types'

export interface CreateWebVMOrchestratorOptions
  extends CreateWebVMProjectManagerOptions {}

export class WebVMOrchestrator {
  static async create(
    options: CreateWebVMOrchestratorOptions
  ): Promise<WebVMOrchestrator> {
    const { preset, projectId } = options

    const projectManager = await WebVMProjectManager.create({
      preset,
      projectId
    })
    const previewManager = new WebVMPreviewManager2(projectManager)
    const orchestrator = new WebVMOrchestrator(projectManager, previewManager)
    await orchestrator.initProject()
    return orchestrator
  }

  private status: WebVMStatus = {
    isInitialized: false,
    isPreviewServerRunning: false,
    serverErrors: [],
    createdAt: Date.now(),
    previewUrl: ''
  }

  private constructor(
    public projectManager: IProjectManager,
    public previewManager: IPreviewManager
  ) {}

  private async safeExecute<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      logger.error(`${errorMessage}: ${error}`)
      throw error
    }
  }

  async initProject(): Promise<void> {
    await this.safeExecute(async () => {
      const preset = this.projectManager.getPreset()
      const baseFiles = preset.getBaseProjectFiles()

      await settledPromiseResults(
        baseFiles.map(
          async file =>
            await this.projectManager.writeFile(
              file.relativePathOrSchemeUri,
              file.content
            )
        )
      )

      this.status.isInitialized = true
    }, t('extension.webvm.orchestrator.errors.initProjectFailed'))
  }

  getStatus(): WebVMStatus {
    this.status.isPreviewServerRunning =
      this.previewManager.getIsPreviewServerRunning()
    this.status.serverErrors = this.previewManager.getServerErrors()
    this.status.previewUrl = this.previewManager.getPreviewUrl()
    return this.status
  }

  async startPreview(): Promise<void> {
    await this.previewManager.startPreviewServer()
  }

  async startPreviewWithFiles(files: WebVMFiles): Promise<void> {
    await this.stopPreview()
    await this.projectManager.cleanProject()
    await this.initProject()
    await settledPromiseResults(
      files.map(
        async file =>
          await this.projectManager.writeFile(
            file.relativePathOrSchemeUri,
            file.content
          )
      )
    )
    await this.previewManager.startPreviewServer()
  }

  async stopPreview(): Promise<void> {
    await this.previewManager.stopPreviewServer()
  }

  async dispose(): Promise<void> {
    await this.stopPreview()
    await this.projectManager.dispose()
    await this.previewManager.dispose()
    logger.log('[Cleanup] Dev server stopped')
  }
}
