import * as vscode from 'vscode'

import { BaseRegister } from '../base-register'
import { AideWebViewProvider } from './webview-provider'

export class WebviewRegister extends BaseRegister {
  provider: AideWebViewProvider | undefined

  async register(): Promise<void> {
    this.provider = new AideWebViewProvider(
      this.context.extensionUri,
      this.context,
      this.registerManager,
      this.commandManager
    )

    const disposable = vscode.window.registerWebviewViewProvider(
      AideWebViewProvider.viewType,
      {
        resolveWebviewView: webviewView =>
          this.provider!.resolveSidebarView(webviewView)
      },
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
    this.context.subscriptions.push(disposable, {
      dispose: () => {
        this.provider?.dispose()
      }
    })

    this.registerManager.commandManager.registerService(
      'AideWebViewProvider',
      this.provider
    )

    this.provider.revealSidebar()
  }

  dispose(): void {
    this.provider?.dispose()
    this.provider = undefined
  }
}
