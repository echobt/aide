import {
  serverActionCollections,
  type ServerActionCollections
} from '@extension/actions'
import type { CommandManager } from '@extension/commands/command-manager'
import { logger } from '@extension/logger'
import type { RegisterManager } from '@extension/registers/register-manager'
import { WebviewRegister } from '@extension/registers/webview-register'
import findFreePorts from 'find-free-ports'
import { Server, type Socket } from 'socket.io'
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

  port!: number

  private io!: Server

  private sockets = new Set<Socket>()

  private socketWebviewMap = new Map<Socket, WebviewPanel>()

  private webviewSocketMap = new Map<WebviewPanel, Socket>()

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

  async init() {
    await this.initServer()
  }

  private async initServer() {
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

    this.io.on('connection', async socket => {
      this.sockets.add(socket)

      socket.on('identify', (webviewId: string) => {
        const webviewRegister =
          this.registerManager.getRegister(WebviewRegister)
        const webview = webviewRegister?.provider?.getWebviewById(webviewId)

        if (webview) {
          this.socketWebviewMap.set(socket, webview)
          this.webviewSocketMap.set(webview, socket)
        }
      })

      await this.initSocketListener(socket)

      socket.on('disconnect', () => {
        const webview = this.socketWebviewMap.get(socket)
        if (webview) {
          this.webviewSocketMap.delete(webview)
          this.socketWebviewMap.delete(socket)
        }
        this.sockets.delete(socket)
      })
    })
  }

  getAllSockets(): Socket[] {
    return Array.from(this.sockets)
  }

  getActiveSocket(): Socket | undefined {
    const webviewRegister = this.registerManager.getRegister(WebviewRegister)
    const activeWebview = webviewRegister?.provider?.getActiveWebview()

    if (activeWebview) {
      return this.webviewSocketMap.get(activeWebview)
    }

    return undefined
  }

  execute(
    context: ActionContext<Params>,
    onStream?: (result: ResultData) => void
  ): ExecuteActionResult<ResultData> {
    if (context.actionType === 'client') {
      const webviewRegister = this.registerManager.getRegister(WebviewRegister)
      webviewRegister?.provider?.revealSidebar()
    }

    return super.execute(context, onStream)
  }

  dispose() {
    super.dispose()
    Object.values(this.sockets).forEach(socket => {
      socket.disconnect()
    })
    this.sockets.clear()
    this.socketWebviewMap.clear()
    this.webviewSocketMap.clear()
    this.io?.close()
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
