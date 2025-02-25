import { ServerLogger } from '@extension/logger'
import type {
  ActionContext,
  ActionDefinition,
  ActionType,
  ExecuteActionResult,
  SocketActionReqMsg,
  SocketActionResMsg
} from '@shared/actions/types'
import { AbortError, getErrorMsg, isAbortError } from '@shared/utils/common'
import { ClientLogger } from '@webview/utils/logger'
import type { Socket as ServerSocket } from 'socket.io'
import type { Socket as ClientSocket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import type { Disposable } from 'vscode'

type PendingRequest<ResultData> = {
  resolve: (actionResult: ResultData) => void
  reject: (error: any) => void
  onStream?: (actionResult: ResultData) => void
  abortController?: AbortController
}

type Socket<Type extends ActionType> = Type extends 'server'
  ? ServerSocket
  : ClientSocket
export abstract class BaseActionManager<
  Type extends ActionType,
  Params extends Record<string, any>,
  ResultData
> {
  pendingRequests: Map<string, PendingRequest<ResultData>> = new Map()

  pendingEmits: Array<{
    eventName: string
    eventParams: SocketActionReqMsg<Params>
  }> = []

  disposables: Disposable[] = []

  abstract defaultWebviewId: string | undefined

  abstract currentActionEnv: Type

  abstract logger: Type extends 'server' ? ServerLogger : ClientLogger

  protected actions = new Map<string, ActionDefinition<Params, ResultData>>()

  abstract getAllSockets(): Socket<Type>[]

  abstract getActiveSocket(webviewId?: string): Socket<Type> | undefined

  registerAction(action: ActionDefinition<Params, ResultData>) {
    const key = `${action.category}:${action.name}`
    this.actions.set(key, action)
  }

  protected findAction(category: string, name: string) {
    const key = `${category}:${name}`
    return this.actions.get(key)
  }

  execute(
    context: ActionContext<Params>,
    onStream?: (result: ResultData) => void
  ): ExecuteActionResult<ResultData> {
    if (this.currentActionEnv === context.actionType) {
      const action = this.findAction(context.actionCategory, context.actionName)
      if (!action) {
        throw new Error(
          `Action ${context.actionCategory}:${context.actionName} not found`
        )
      }

      if (onStream)
        throw new Error(
          "Don't use onStream when execute action in the same environment"
        )

      return action.execute(context)
    }

    return this.executeAction(context, onStream)
  }

  async initSocketListener(socket: Socket<Type>) {
    await this.handleReceiveExecuteAction(socket)
    await this.handleReceiveActionResult(socket)
    await this.handleReEmit(socket)
  }

  private async handleReceiveExecuteAction(socket: Socket<Type>) {
    socket.on('executeAction', async (message: SocketActionReqMsg<Params>) => {
      const { id } = message
      const abortController = new AbortController()

      const actionContext: ActionContext<Params> = {
        ...message.actionContext,
        abortController
      }

      socket.once(`abort-${id}`, () => {
        abortController.abort()
      })

      if (this.currentActionEnv !== actionContext.actionType) {
        socket.emit('actionError', {
          id,
          actionResult: `Don't execute ${actionContext.actionType} action in ${this.currentActionEnv} by socket`
        } satisfies SocketActionResMsg)
        return
      }

      try {
        // this.logger.verbose('executeAction', {
        //   currentActionEnv: this.currentActionEnv,
        //   ...actionContext
        // })
        const result = await this.execute(actionContext)

        if (
          result &&
          typeof (result as any)[Symbol.asyncIterator] === 'function'
        ) {
          try {
            for await (const chunk of result as AsyncGenerator<
              ResultData,
              void,
              unknown
            >) {
              if (abortController.signal.aborted) break

              const msgRes: SocketActionResMsg = {
                id,
                actionResult: chunk
              }

              socket.emit('actionStream', msgRes)
            }
            socket.emit('actionStreamEnd', { id })
          } catch (error) {
            // skip abort error
            if (isAbortError(error)) {
              socket.emit(`abort-${id}`, { id })
            } else {
              throw error
            }
          }
        } else {
          socket.emit('actionResult', {
            id,
            actionResult: result as ResultData
          } satisfies SocketActionResMsg)
        }
      } catch (error) {
        this.logger.error('executeAction error', error)
        socket.emit('actionError', {
          id,
          actionResult: getErrorMsg(error)
        } satisfies SocketActionResMsg)
      }
    })
  }

  private handleReceiveActionResult(socket: Socket<Type>) {
    socket.on('actionResult', (message: SocketActionResMsg) => {
      const pending = this.pendingRequests.get(message.id)
      if (!pending) return

      pending.resolve(message.actionResult)
      this.pendingRequests.delete(message.id)
    })

    socket.on('actionStream', (message: SocketActionResMsg) => {
      const pending = this.pendingRequests.get(message.id)
      if (!pending) return

      pending.onStream?.(message.actionResult)
    })

    socket.on('actionStreamEnd', (message: SocketActionResMsg) => {
      const pending = this.pendingRequests.get(message.id)
      if (!pending) return

      pending.resolve(undefined as any)
      this.pendingRequests.delete(message.id)
    })

    socket.on('actionError', (message: SocketActionResMsg) => {
      const pending = this.pendingRequests.get(message.id)
      if (!pending) return

      pending.reject(new Error(message.actionResult))
      this.pendingRequests.delete(message.id)
    })
  }

  private handleReEmit(socket: Socket<Type>) {
    this.pendingEmits.forEach(({ eventName, eventParams }) => {
      socket.emit(eventName, eventParams)
    })
  }

  private emitExecuteAction(
    socket: Socket<Type>,
    eventParams: SocketActionReqMsg<Params>
  ) {
    const eventName = 'executeAction'

    this.logger.verbose(eventName, {
      eventParams,
      currentActionEnv: this.currentActionEnv
    })

    if (!socket) {
      this.pendingEmits.push({
        eventName,
        eventParams
      })
    } else {
      socket.emit(eventName, eventParams)
    }
  }

  private async executeAction(
    actionContext: ActionContext<Params>,
    onStream?: (result: ResultData) => void
  ): Promise<ResultData> {
    return new Promise<ResultData>((resolve, reject) => {
      const id = uuidv4()
      const abortController =
        actionContext.abortController || new AbortController()
      const sockets = this.getAllSockets()

      if (!actionContext.webviewId) {
        actionContext.webviewId = this.defaultWebviewId
      }

      const activeSocket = this.getActiveSocket(actionContext.webviewId)

      if (abortController) {
        abortController.signal.addEventListener(
          'abort',
          () => {
            sockets.forEach(socket => {
              socket.emit(`abort-${id}`, { id })
            })

            const pending = this.pendingRequests.get(id)
            if (pending) {
              pending.reject(AbortError)
              this.pendingRequests.delete(id)
            }
          },
          { once: true }
        )
      }

      this.pendingRequests.set(id, {
        resolve,
        reject,
        onStream,
        abortController
      })

      if (activeSocket) {
        this.emitExecuteAction(activeSocket, {
          id,
          actionContext
        })
      } else {
        this.logger.warn('no active socket, re-emit to all sockets', {
          actionContext
        })
        sockets.forEach(socket => {
          this.emitExecuteAction(socket, {
            id,
            actionContext
          })
        })
      }
    })
  }

  dispose() {
    this.disposables.forEach(dispose => dispose.dispose())
    this.disposables = []
  }
}
