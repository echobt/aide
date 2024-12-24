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
import type { Server as ServerIO } from 'socket.io'
import type { Socket as ClientIO } from 'socket.io-client'
import type { Disposable } from 'vscode'

type PendingRequest<ResultData> = {
  resolve: (actionResult: ResultData) => void
  reject: (error: any) => void
  onStream?: (actionResult: ResultData) => void
  abortController?: AbortController
}

export abstract class BaseActionManager<
  Type extends ActionType,
  Params extends Record<string, any>,
  ResultData
> {
  messageId = 0

  io!: Type extends 'server' ? ServerIO : ClientIO

  socket!: Type extends 'server' ? ServerIO : ClientIO

  pendingRequests: Map<number, PendingRequest<ResultData>> = new Map()

  pendingEmits: Array<{
    eventName: string
    eventParams: SocketActionReqMsg<Params>
  }> = []

  disposes: Disposable[] = []

  abstract currentActionEnv: Type

  abstract logger: Type extends 'server' ? ServerLogger : ClientLogger

  protected actions = new Map<string, ActionDefinition<Params, ResultData>>()

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

  async initSocketListener() {
    if (this.currentActionEnv === 'server') {
      this.io.on('connection', async socket => {
        this.socket = socket
        await this.handleReceiveExecuteAction()
        await this.handleReceiveActionResult()
        await this.handleReEmit()
      })
    } else {
      this.socket = this.io
      await this.handleReceiveExecuteAction()
      await this.handleReceiveActionResult()
      await this.handleReEmit()
    }
  }

  private async handleReceiveExecuteAction() {
    this.socket.on(
      'executeAction',
      async (message: SocketActionReqMsg<Params>) => {
        const { id } = message
        const abortController = new AbortController()

        const actionContext: ActionContext<Params> = {
          ...message.actionContext,
          abortController
        }

        this.socket.once(`abort-${id}`, () => {
          abortController.abort()
        })

        if (this.currentActionEnv !== actionContext.actionType) {
          this.socket.emit('actionError', {
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

                this.socket.emit('actionStream', msgRes)
              }
              this.socket.emit('actionStreamEnd', { id })
            } catch (error) {
              // skip abort error
              if (isAbortError(error)) {
                this.socket.emit(`abort-${id}`, { id })
              } else {
                throw error
              }
            }
          } else {
            this.socket.emit('actionResult', {
              id,
              actionResult: result as ResultData
            } satisfies SocketActionResMsg)
          }
        } catch (error) {
          this.logger.error('executeAction error', error)
          this.socket.emit('actionError', {
            id,
            actionResult: getErrorMsg(error)
          } satisfies SocketActionResMsg)
        }
      }
    )
  }

  private handleReceiveActionResult() {
    this.socket.on('actionResult', (message: SocketActionResMsg) => {
      const pending = this.pendingRequests.get(message.id)
      if (!pending) return

      pending.resolve(message.actionResult)
      this.pendingRequests.delete(message.id)
    })

    this.socket.on('actionStream', (message: SocketActionResMsg) => {
      const pending = this.pendingRequests.get(message.id)
      if (!pending) return

      pending.onStream?.(message.actionResult)
    })

    this.socket.on('actionStreamEnd', (message: SocketActionResMsg) => {
      const pending = this.pendingRequests.get(message.id)
      if (!pending) return

      pending.resolve(undefined as any)
      this.pendingRequests.delete(message.id)
    })

    this.socket.on('actionError', (message: SocketActionResMsg) => {
      const pending = this.pendingRequests.get(message.id)
      if (!pending) return

      pending.reject(new Error(message.actionResult.error))
      this.pendingRequests.delete(message.id)
    })
  }

  private handleReEmit() {
    this.pendingEmits.forEach(({ eventName, eventParams }) => {
      this.socket.emit(eventName, eventParams)
    })
  }

  private emitExecuteAction(eventParams: SocketActionReqMsg<Params>) {
    const eventName = 'executeAction'

    this.logger.verbose(eventName, {
      eventParams,
      currentActionEnv: this.currentActionEnv
    })

    if (!this.socket) {
      this.pendingEmits.push({
        eventName,
        eventParams
      })
    } else {
      this.socket.emit(eventName, eventParams)
    }
  }

  private async executeAction(
    actionContext: ActionContext<Params>,
    onStream?: (result: ResultData) => void
  ): Promise<ResultData> {
    return new Promise<ResultData>((resolve, reject) => {
      const id = this.messageId++
      const abortController =
        actionContext.abortController || new AbortController()

      if (abortController) {
        abortController.signal.addEventListener(
          'abort',
          () => {
            this.socket.emit(`abort-${id}`, { id })
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

      this.emitExecuteAction({
        id,
        actionContext
      })
    })
  }

  dispose() {
    this.disposes.forEach(dispose => dispose.dispose())
    if (this.currentActionEnv === 'server') {
      this.io.close()
    }
    this.socket.removeAllListeners()
  }
}
