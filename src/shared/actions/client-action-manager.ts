import {
  clientActionCollections,
  type ClientActionCollections
} from '@webview/actions'
import { logger } from '@webview/utils/logger'
import { io } from 'socket.io-client'

import { BaseActionManager } from './base-action-manager'
import type {
  ActionContext,
  ActionType,
  AllActionsConfigs,
  AllActionsProxy
} from './types'

export class ClientActionManager<
  Params extends Record<string, any> = Record<string, any>,
  ResultData = any
> extends BaseActionManager<'client', Params, ResultData> {
  currentActionEnv = 'client' as const

  logger = logger

  constructor(clientActionCollections: ClientActionCollections) {
    super()

    for (const ClientActionCollectionClass of clientActionCollections) {
      const actionCollection = new ClientActionCollectionClass()

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
    const port = window.vscodeWebviewState?.socketPort

    if (!port) throw new Error('Socket port not found in VSCode state')

    this.io = io(`http://localhost:${port}`)
    await this.initSocketListener()
  }
}

export const createClientActionManager = () => {
  const clientActionManager = new ClientActionManager(clientActionCollections)
  return clientActionManager
}

export const createApi = () => {
  const clientActionManager = createClientActionManager()

  const execute = <
    T extends AllActionsConfigs,
    Context extends T['context'],
    Result extends Extract<
      AllActionsConfigs,
      {
        context: {
          actionType: Context['actionType']
          actionCategory: Context['actionCategory']
          actionName: Context['actionName']
        }
      }
    >['result']
  >(
    context: Context,
    onStream?: Context['actionType'] extends 'server'
      ? (result: Result) => void
      : never
  ): Result => clientActionManager.execute(context, onStream) as Result

  const actions = (): AllActionsProxy => {
    const proxy = new Proxy(
      {},
      {
        get: (target, actionType: ActionType) =>
          new Proxy(
            {},
            {
              get: (target, actionCategory: string) =>
                new Proxy(
                  {},
                  {
                    get:
                      (target, actionName: string) =>
                      (
                        context: Omit<
                          ActionContext<any>,
                          'actionType' | 'actionCategory' | 'actionName'
                        >,
                        onStream?: (result: any) => void
                      ) =>
                        clientActionManager.execute(
                          {
                            ...context,
                            actionType,
                            actionCategory,
                            actionName
                          },
                          onStream
                        )
                  }
                )
            }
          )
      }
    ) as AllActionsProxy

    return proxy
  }

  return {
    api: {
      execute,
      actions
    },
    initApi: clientActionManager.init.bind(clientActionManager)
  }
}
