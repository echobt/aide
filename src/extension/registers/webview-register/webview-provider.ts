import * as os from 'os'
import type { CommandManager } from '@extension/commands/command-manager'
import { type WebviewPanel } from '@shared/actions/server-action-manager'
import { v4 as uuidv4 } from 'uuid'
import * as vscode from 'vscode'

import { ActionRegister } from '../action-register'
import type { RegisterManager } from '../register-manager'
import type { WebviewState } from './types'
import { setupHtml } from './utils'

export class AideWebViewProvider {
  static readonly viewType = 'aide-webview'

  private disposes: vscode.Disposable[] = []

  private idWebviewMap = new Map<string, WebviewPanel>()

  private lastActiveWebview?: WebviewPanel

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
    await this.setupWebview(webviewView, {
      isSidebarWebview: true
    })
  }

  async createEditorWebview(props: {
    title?: string
    webviewState?: Partial<WebviewState>
    showOptions?: Partial<{
      viewColumn: vscode.ViewColumn
      preserveFocus?: boolean
    }>
    options?: Partial<vscode.WebviewPanelOptions & vscode.WebviewOptions>
  }) {
    const { title, showOptions, options, webviewState } = props

    this.webviewPanel = vscode.window.createWebviewPanel(
      AideWebViewProvider.viewType,
      title || 'AIDE',
      {
        viewColumn: vscode.ViewColumn.Active,
        preserveFocus: true,
        ...showOptions
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist/webview')
        ],
        ...options
      }
    )

    await this.setupWebview(this.webviewPanel, {
      ...webviewState,
      isSidebarWebview: false
    })

    this.webviewPanel.onDidDispose(
      () => {
        this.removeWebview(this.webviewPanel!)
        this.webviewPanel = undefined
      },
      null,
      this.context.subscriptions
    )

    return this.webviewPanel
  }

  async createOrShowWebviewPanel() {
    if (this.webviewPanel) {
      this.webviewPanel.reveal(vscode.ViewColumn.Beside)
    } else {
      await this.createEditorWebview({})
    }
  }

  private addWebview(id: string, webview: WebviewPanel) {
    this.idWebviewMap.set(id, webview)
    this.updateActiveWebview(webview)

    if ('onDidChangeViewState' in webview) {
      const dispose = webview.onDidChangeViewState(e => {
        if (webview.active || e.webviewPanel.active)
          this.updateActiveWebview(webview)
      })
      this.disposes.push(dispose)
    }

    if ('onDidChangeVisibility' in webview) {
      const dispose = webview.onDidChangeVisibility(() => {
        if ((webview as vscode.WebviewView).visible)
          this.updateActiveWebview(webview)
      })
      this.disposes.push(dispose)
    }

    const dispose = webview.webview.onDidReceiveMessage(message => {
      if (message.type === 'webview-focused') this.updateActiveWebview(webview)
    })
    this.disposes.push(dispose)
  }

  private removeWebview(webview: WebviewPanel) {
    let id = ''
    this.idWebviewMap.forEach((_webview, _id) => {
      if (webview === _webview) {
        id = _id
      }
    })
    this.idWebviewMap.delete(id)

    this.updateActiveWebview()
  }

  isWebviewPanelExists(webview: WebviewPanel | undefined) {
    if (!webview) return false

    return Array.from(this.idWebviewMap.values()).some(
      _webview => _webview === webview
    )
  }

  updateActiveWebview(webview?: WebviewPanel) {
    const allWebviews = this.getAllWebviews()

    if (!webview || !allWebviews.includes(webview)) {
      // eslint-disable-next-line prefer-destructuring
      this.lastActiveWebview = allWebviews[0]
    } else {
      this.lastActiveWebview = webview
    }
  }

  getActiveWebview() {
    return this.lastActiveWebview
  }

  getAllWebviews() {
    return Array.from(this.idWebviewMap.values())
  }

  getWebviewById(id: string) {
    return this.idWebviewMap.get(id)
  }

  getIdByWebview(webview: WebviewPanel) {
    return Array.from(this.idWebviewMap.entries()).find(
      ([_, _webview]) => _webview === webview
    )?.[0]
  }

  private async setupWebview(
    webview: WebviewPanel,
    webviewState?: Partial<WebviewState>
  ) {
    const id = uuidv4()
    this.addWebview(id, webview)

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

    webview.webview.html = this.getHtmlForWebview(
      {
        webviewId: id,
        isWin: os.platform() === 'win32',
        socketPort: actionRegister.serverActionManager.port,
        ...webviewState
      },
      webview.webview
    )

    webview.onDidDispose(() => {
      this.removeWebview(webview)
    })
  }

  revealSidebar() {
    vscode.commands.executeCommand('workbench.view.extension.aide-sidebar-view')
    this.sidebarView?.show?.(true)
  }

  private getHtmlForWebview(state: WebviewState, webview: vscode.Webview) {
    return setupHtml(state, webview, this.context)
  }

  dispose() {
    this.disposes.forEach(dispose => dispose.dispose())
    this.disposes = []
    this.idWebviewMap.clear()
    this.lastActiveWebview = undefined
    this.webviewPanel?.dispose()
    this.webviewPanel = undefined
    this.sidebarView = undefined
  }
}
