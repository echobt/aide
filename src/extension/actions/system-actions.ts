import * as os from 'os'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import * as vscode from 'vscode'

export interface SystemInfo {
  os: string
  cpu: string
  memory: string
  platform: string
}

export class SystemActionsCollection extends ServerActionCollection {
  readonly categoryName = 'system'

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
}
