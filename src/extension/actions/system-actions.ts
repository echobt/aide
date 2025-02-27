import * as os from 'os'
import { logger } from '@extension/logger'
import { WebviewRegister } from '@extension/registers/webview-register'
import { runAction } from '@extension/state'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { settledPromiseResults } from '@shared/utils/common'
import { pkg } from '@shared/utils/pkg'
import { t } from 'i18next'
import * as vscode from 'vscode'

export interface SystemInfo {
  os: string
  cpu: string
  memory: string
  platform: string
}

export class SystemActionsCollection extends ServerActionCollection {
  readonly categoryName = 'system'

  private getWebviewProvider() {
    const webviewRegister = this.registerManager.getRegister(WebviewRegister)
    const webviewProvider = webviewRegister?.provider

    if (!webviewProvider)
      throw new Error(t('extension.system.errors.webviewProviderNotFound'))

    return webviewProvider
  }

  async getSystemInfo(context: ActionContext<{}>): Promise<SystemInfo> {
    return {
      os: `${os.type()} ${os.release()}`,
      cpu: os.cpus()[0]?.model || 'Unknown',
      memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
      platform: os.platform()
    }
  }

  async isWindows(context: ActionContext<{}>): Promise<boolean> {
    return os.platform() === 'win32'
  }

  async openLink(context: ActionContext<{ url: string }>) {
    const { url } = context.actionParams
    await vscode.env.openExternal(vscode.Uri.parse(url))
  }

  async copyToClipboard(context: ActionContext<{ text: string }>) {
    const { text } = context.actionParams
    await vscode.env.clipboard.writeText(text)
  }

  private async notifyOtherWebviews(
    currentWebviewId: string,
    callback: (webviewId: string) => Promise<void>
  ) {
    const webviewProvider = this.getWebviewProvider()
    const webviewIds = webviewProvider.getAllWebviewIds()

    await settledPromiseResults(
      webviewIds
        .filter(id => id !== currentWebviewId)
        .map(async id => await callback(id))
    )
  }

  async invalidAllWebViewQueries(
    context: ActionContext<{
      queryKeys: string[]
    }>
  ) {
    const { queryKeys } = context.actionParams
    const sourceWebviewId = context.webviewId
    if (!sourceWebviewId) return { success: true }

    await this.notifyOtherWebviews(sourceWebviewId, async id => {
      await runAction(this.registerManager).client.common.invalidQueryKeys({
        ...context,
        webviewId: id,
        actionParams: { keys: queryKeys }
      })
    })

    return { success: true }
  }

  // remove ANSI color codes
  private stripAnsiColorCodes(text: string): string {
    // eslint-disable-next-line no-control-regex
    const ansiRegex = /\u001b\[\d+(;\d+)*m/g
    return text.replace(ansiRegex, '')
  }

  async openEditorWithLogs(context: ActionContext<{ webviewLogs: string[] }>) {
    const { webviewLogs } = context.actionParams
    const editor = await vscode.window.showTextDocument(
      vscode.Uri.parse('untitled:Aide Error Logs'),
      {
        viewColumn: vscode.ViewColumn.Active
      }
    )

    // Format logs with header information
    const issueUrl = pkg.issuesUrl
    const aideVersion = pkg.version || 'Unknown'
    const vscodeVersion = vscode.version || 'Unknown'
    const nodeVersion = process.version || 'Unknown'

    // Get system info
    const systemInfo = await this.getSystemInfo(context)

    const timestamp = new Date().toISOString()

    const headerInfo = [
      `# ${t('extension.system.logs.title')} - ${timestamp}`,
      '',
      `## ${t('extension.system.logs.systemInfo')}`,
      '',
      `- ${t('extension.system.logs.os')}: ${systemInfo.os}`,
      `- ${t('extension.system.logs.cpu')}: ${systemInfo.cpu}`,
      `- ${t('extension.system.logs.memory')}: ${systemInfo.memory}`,
      `- ${t('extension.system.logs.platform')}: ${systemInfo.platform}`,
      '',
      `## ${t('extension.system.logs.versionInfo')}`,
      '',
      `- ${t('extension.system.logs.aideVersion')}: ${aideVersion}`,
      `- ${t('extension.system.logs.vscodeVersion')}: ${vscodeVersion}`,
      `- ${t('extension.system.logs.nodeVersion')}: ${nodeVersion}`,
      '',
      `${t('extension.system.logs.reportIssue', { issueUrl })}`,
      '',
      `## ${t('extension.system.logs.serverLogs')}`,
      '',
      ''
    ].join('\n')

    // get server logs and remove ANSI color codes
    const cleanedServerLogs = logger.logBuffer
      .map(log => this.stripAnsiColorCodes(log))
      .join('\n')

    // process webview logs and remove ANSI color codes
    const cleanedWebviewLogs = webviewLogs
      .filter(log => !log.includes('webviewLogs'))
      .map(log => this.stripAnsiColorCodes(log))

    // add webview logs
    const webviewLogsFormatted = [
      '',
      '',
      `## ${t('extension.system.logs.webviewLogs')}`,
      '',
      cleanedWebviewLogs.join('\n')
    ].join('\n')

    // combine all logs
    const content = `${headerInfo}${cleanedServerLogs}${webviewLogsFormatted}`

    await editor.edit(editBuilder => {
      editBuilder.insert(new vscode.Position(0, 0), content)
    })

    return { success: true }
  }
}
