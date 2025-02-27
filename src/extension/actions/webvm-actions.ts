import { logger } from '@extension/logger'
import { WebviewRegister } from '@extension/registers/webview-register'
import type { WebviewState } from '@extension/registers/webview-register/types'
import { WebVMRegister } from '@extension/registers/webvm-register'
import type {
  WebVMFiles,
  WebVMStatus
} from '@extension/registers/webvm-register/types'
import { runAction } from '@extension/state'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { WebPreviewProjectFile } from '@shared/entities'
import { removeDuplicates } from '@shared/utils/common'
import type { OpenWebPreviewParams } from '@webview/actions/web-preview'
import { t } from 'i18next'
import * as vscode from 'vscode'
import { z } from 'zod'

export interface WebVMPresetInfo {
  presetName: string
  presetFrameworkName: string
}

// Add schema validation
const webVMPresetInfoSchema = z.object({
  presetName: z
    .string()
    .min(1, t('extension.webvm.validation.presetNameRequired')),
  presetFrameworkName: z
    .string()
    .min(1, t('extension.webvm.validation.frameworkNameRequired'))
})

const startPreviewVMFilesSchema = z.object({
  projectName: z
    .string()
    .min(1, t('extension.webvm.validation.projectNameRequired')),
  sessionId: z
    .string()
    .min(1, t('extension.webvm.validation.sessionIdRequired')),
  presetName: z
    .string()
    .min(1, t('extension.webvm.validation.presetNameRequired')),
  files: z.array(
    z.object({
      content: z.string(),
      path: z.string().min(1, t('extension.webvm.validation.filePathRequired'))
    })
  )
})

const vmActionParamsSchema = z.object({
  projectName: z
    .string()
    .min(1, t('extension.webvm.validation.projectNameRequired')),
  sessionId: z
    .string()
    .min(1, t('extension.webvm.validation.sessionIdRequired')),
  presetName: z
    .string()
    .min(1, t('extension.webvm.validation.presetNameRequired'))
})

export class WebVMActionsCollection extends ServerActionCollection {
  readonly categoryName = 'webvm'

  private sessionIdWebviewIdMap = new Map<string, string>()

  private getWebviewProvider() {
    const webviewRegister = this.registerManager.getRegister(WebviewRegister)
    const webviewProvider = webviewRegister?.provider

    if (!webviewProvider)
      throw new Error(t('extension.webvm.errors.webviewProviderNotFound'))

    return webviewProvider
  }

  private getWebVMRegister() {
    const webvmRegister = this.registerManager.getRegister(WebVMRegister)

    if (!webvmRegister)
      throw new Error(t('extension.webvm.errors.webvmRegisterNotFound'))

    return webvmRegister
  }

  private async openOrCreateEditorWebview(
    sessionId: string,
    webviewState?: Partial<WebviewState>
  ) {
    const webviewProvider = this.getWebviewProvider()
    const oldWebviewId = this.sessionIdWebviewIdMap.get(sessionId)
    const oldWebview = oldWebviewId
      ? (webviewProvider.getWebviewById(oldWebviewId) as vscode.WebviewPanel)
      : undefined
    const isExists = webviewProvider.isWebviewPanelExists(oldWebview)

    if (isExists && oldWebview) {
      // Show existing webview
      oldWebview.reveal(vscode.ViewColumn.Active, false)
      const webviewId = webviewProvider.getIdByWebview(oldWebview)

      if (webviewState?.initRouterPath && webviewId) {
        await runAction(this.registerManager).client.common.goToPage({
          webviewId,
          actionParams: {
            path: webviewState.initRouterPath,
            replace: true
          }
        })
      }

      return oldWebview
    }

    const newWebview = await webviewProvider.createEditorWebview({
      title: t('extension.webvm.webview.title'),
      showOptions: {
        viewColumn: vscode.ViewColumn.Active,
        preserveFocus: false
      },
      webviewState
    })
    const webviewId = webviewProvider.getIdByWebview(newWebview)

    if (webviewId) {
      this.sessionIdWebviewIdMap.set(sessionId, webviewId)
    }

    return newWebview
  }

  async copyToClipboard(context: ActionContext<{ text: string }>) {
    const { actionParams } = context
    const { text } = actionParams

    // Copy text to clipboard
    await vscode.env.clipboard.writeText(text)
  }

  async openWebviewForFullScreen(context: ActionContext<OpenWebPreviewParams>) {
    const { actionParams } = context
    const {
      sessionId,
      projectName,
      projectVersion,
      tab,
      activeFilePath,
      timestamp
    } = actionParams

    const searchParams = new URLSearchParams()
    searchParams.set('sessionId', sessionId)
    projectName && searchParams.set('projectName', projectName)
    tab && searchParams.set('tab', tab)
    activeFilePath && searchParams.set('activeFilePath', activeFilePath)
    timestamp && searchParams.set('timestamp', String(timestamp))

    // sometimes projectVersion is 0
    if (projectVersion === 0 || projectVersion)
      searchParams.set('projectVersion', String(projectVersion))

    await this.openOrCreateEditorWebview(sessionId, {
      initRouterPath: `/web-preview?${searchParams.toString()}`
    })
  }

  async refreshWebview(context: ActionContext<{ sessionId: string }>) {
    const { actionParams } = context
    const { sessionId } = actionParams

    const webviewId = this.sessionIdWebviewIdMap.get(sessionId)

    if (!webviewId) return

    const webviewProvider = this.getWebviewProvider()
    const webview = webviewProvider.getWebviewById(
      webviewId
    ) as vscode.WebviewPanel

    if (!webview) return

    await runAction(this.registerManager).client.webPreview.refreshWebview({
      ...context
    })
  }

  async getPresetInfo(context: ActionContext<{ presetName: string }>) {
    try {
      const { actionParams } = context
      const { presetName } = actionParams

      // Validate presetName
      await z
        .string()
        .min(1, t('extension.webvm.validation.presetNameRequired'))
        .parseAsync(presetName)

      const presetInfo = this.getWebVMRegister().getPresetInfo(presetName)

      // Validate preset info
      await webVMPresetInfoSchema.parseAsync(presetInfo)

      return presetInfo
    } catch (error) {
      logger.error('Failed to get preset info:', error)
      throw error
    }
  }

  async getPresetsInfo(context: ActionContext<{}>) {
    try {
      const presetsInfo = this.getWebVMRegister().getPresetsInfo()

      return presetsInfo
    } catch (error) {
      logger.error('Failed to get presets info:', error)
      throw error
    }
  }

  private getProjectId(projectName: string, sessionId: string) {
    return `${projectName}-${sessionId}`
  }

  async startPreviewVMFiles(
    context: ActionContext<{
      projectName: string
      sessionId: string
      presetName: string
      files: WebPreviewProjectFile[]
    }>
  ) {
    try {
      const { actionParams } = context

      // Validate input params
      await startPreviewVMFilesSchema.parseAsync(actionParams)

      const { projectName, sessionId, presetName, files } = actionParams

      const projectId = this.getProjectId(projectName, sessionId)
      const webvmRegister = this.getWebVMRegister()
      const preset = await this.getWebVMRegister().getPreset(presetName)
      const orchestrator = await webvmRegister.getOrCreateOrchestrator(
        projectId,
        presetName
      )
      const finalFiles: WebVMFiles = removeDuplicates(
        [
          ...(preset?.getBaseProjectFiles() ?? []),
          ...files.map(file => ({
            content: file.content ?? '',
            relativePathOrSchemeUri: file.path
          }))
        ],
        ['relativePathOrSchemeUri']
      )

      await orchestrator.startPreviewWithFiles(finalFiles)

      logger.dev.log('startPreviewVMFiles', {
        vmId: webvmRegister.getOrchestratorId(projectId, presetName),
        status: orchestrator.getStatus(),
        finalFilePaths: finalFiles.map(file => file.relativePathOrSchemeUri)
      })

      return {
        vmId: webvmRegister.getOrchestratorId(projectId, presetName),
        status: orchestrator.getStatus()
      }
    } catch (error) {
      logger.error('Failed to start preview VM files:', error)
      throw error
    }
  }

  async stopPreviewVM(
    context: ActionContext<{
      projectName: string
      sessionId: string
      presetName: string
    }>
  ) {
    try {
      const { actionParams } = context

      // Validate input params
      await vmActionParamsSchema.parseAsync(actionParams)

      const { projectName, sessionId, presetName } = actionParams

      const projectId = this.getProjectId(projectName, sessionId)
      const webvmRegister = this.getWebVMRegister()
      const orchestrator = webvmRegister.getOrchestrator(projectId, presetName)

      if (orchestrator) {
        await orchestrator.stopPreview()
      }

      return {
        vmId: webvmRegister.getOrchestratorId(projectId, presetName),
        status: orchestrator?.getStatus()
      }
    } catch (error) {
      logger.error('Failed to stop preview VM:', error)
      throw error
    }
  }

  async getVMStatus(
    context: ActionContext<{
      projectName: string
      sessionId: string
      presetName: string
    }>
  ): Promise<WebVMStatus | null> {
    try {
      const { actionParams } = context

      // Validate input params
      await vmActionParamsSchema.parseAsync(actionParams)

      const { projectName, sessionId, presetName } = actionParams

      const projectId = this.getProjectId(projectName, sessionId)
      const webvmRegister = this.getWebVMRegister()
      const orchestrator = webvmRegister.getOrchestrator(projectId, presetName)

      if (!orchestrator) return null

      return orchestrator.getStatus()
    } catch (error) {
      logger.error('Failed to get VM status:', error)
      throw error
    }
  }
}
