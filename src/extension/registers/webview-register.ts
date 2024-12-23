import type { CommandManager } from '@extension/commands/command-manager'
import { setupHtml } from '@extension/utils'
import { type WebviewPanel } from '@shared/actions/server-action-manager'
import * as vscode from 'vscode'

import { ActionRegister } from './action-register'
import { BaseRegister } from './base-register'
import type { RegisterManager } from './register-manager'

export class AideWebViewProvider {
  static readonly viewType = 'aide-webview'

  private disposes: vscode.Disposable[] = []

  webviewPanel: vscode.WebviewPanel | undefined

  sidebarView: vscode.WebviewView | undefined

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext,
    private readonly registerManager: RegisterManager,
    private readonly commandManager: CommandManager
  ) {}

  async resolveSidebarView(webviewView: vscode.WebviewView) {
    this.sidebarView = webviewView
    await this.setupWebview(webviewView)
  }

  async createOrShowWebviewPanel() {
    if (this.webviewPanel) {
      this.webviewPanel.reveal(vscode.ViewColumn.Beside)
    } else {
      this.webviewPanel = vscode.window.createWebviewPanel(
        AideWebViewProvider.viewType,
        'AIDE',
        {
          viewColumn: vscode.ViewColumn.Active,
          preserveFocus: true
        },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.extensionUri, 'dist/webview')
          ]
        }
      )
      await this.setupWebview(this.webviewPanel)

      this.webviewPanel.onDidDispose(
        () => {
          this.webviewPanel = undefined
        },
        null,
        this.context.subscriptions
      )
    }
  }

  private async setupWebview(webview: WebviewPanel) {
    if ('options' in webview.webview) {
      webview.webview.options = {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist/webview')
        ]
      }
    }

    const actionRegister = this.registerManager.getRegister(ActionRegister)

    if (!actionRegister) {
      throw new Error('ActionRegister not found')
    }

    await actionRegister.serverActionManager.init(webview)

    this.disposes.push({
      dispose: () => {
        actionRegister.serverActionManager.dispose()
      }
    })

    webview.webview.html = this.getHtmlForWebview(webview.webview)

    webview.onDidDispose(() => {
      actionRegister.serverActionManager.dispose()
    })
  }

  revealSidebar() {
    vscode.commands.executeCommand('workbench.view.extension.aide-sidebar-view')
    this.sidebarView?.show?.(true)
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    return setupHtml(webview, this.context)
  }

  dispose() {
    this.disposes.forEach(dispose => dispose.dispose())
    this.disposes = []
    this.webviewPanel?.dispose()
    this.webviewPanel = undefined
    this.sidebarView = undefined
  }
}

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
