import {
  serverActionCollections,
  type ServerActionCollections
} from '@extension/actions'
import type { CommandManager } from '@extension/commands/command-manager'
import { logger } from '@extension/logger'
import type { RegisterManager } from '@extension/registers/register-manager'
import { WebviewRegister } from '@extension/registers/webview-register'
import findFreePorts from 'find-free-ports'
import { Server } from 'socket.io'
import * as vscode from 'vscode'

import { BaseActionManager } from './base-action-manager'
import type { ActionContext, ExecuteActionResult } from './types'

export type WebviewPanel = vscode.WebviewPanel | vscode.WebviewView

export class ServerActionManager<
  Params extends Record<string, any> = Record<string, any>,
  ResultData = any
> extends BaseActionManager<'server', Params, ResultData> {
  currentActionEnv = 'server' as const

  logger = logger

  private port!: number

  constructor(
    private context: vscode.ExtensionContext,
    private registerManager: RegisterManager,
    private commandManager: CommandManager,
    serverActionCollections: ServerActionCollections
  ) {
    super()

    for (const ServerActionCollectionClass of serverActionCollections) {
      const actionCollection = new ServerActionCollectionClass(
        this.registerManager,
        this.commandManager
      )

      const instanceMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(actionCollection)
      )

      for (const name of instanceMethods) {
        const action = actionCollection[name]

        if (name !== 'constructor' && typeof action === 'function') {
          this.registerAction({
            category: actionCollection.categoryName,
            name,
            execute: action.bind(actionCollection)
          })
        }
      }
    }
  }

  async init(panel?: WebviewPanel) {
    await this.initServer()

    if (!panel) return

    const listenerDispose = panel.webview.onDidReceiveMessage(e => {
      if (e.type === 'getVSCodeSocketPort') {
        panel.webview.postMessage({ socketPort: this.port })
      }
    })

    this.disposes.push(listenerDispose)
  }

  async initServer() {
    if (this.port) return

    const freePorts = await findFreePorts.findFreePorts(1, {
      startPort: 3001,
      endPort: 7999
    })

    if (!freePorts.length) throw new Error('No free ports found')

    this.port = freePorts[0]!
    this.io = new Server(this.port, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    await this.initSocketListener()
  }

  execute(
    context: ActionContext<Params>,
    onStream?: (result: ResultData) => void
  ): ExecuteActionResult<ResultData> {
    if (context.actionType === 'client') {
      // Check if there's an open webview, if not open the sidebar webview
      const webviewRegister = this.registerManager.getRegister(WebviewRegister)
      webviewRegister?.provider?.revealSidebar()
    }

    return super.execute(context, onStream)
  }
}

export const createServerActionManager = (
  context: vscode.ExtensionContext,
  registerManager: RegisterManager,
  commandManager: CommandManager
) => {
  const serverActionManager = new ServerActionManager(
    context,
    registerManager,
    commandManager,
    serverActionCollections
  )
  return serverActionManager
}
