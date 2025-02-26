import * as os from 'os'
import { WebviewRegister } from '@extension/registers/webview-register'
import { runAction } from '@extension/state'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { settledPromiseResults } from '@shared/utils/common'
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

    if (!webviewProvider) throw new Error('Webview provider not found')

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
}
