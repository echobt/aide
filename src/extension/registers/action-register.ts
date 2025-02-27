import type { CommandManager } from '@extension/commands/command-manager'
import { globalSettingsDB } from '@extension/lowdb/settings-db'
import {
  createServerActionManager,
  ServerActionManager
} from '@shared/actions/server-action-manager'
import type {
  ActionContext,
  ActionType,
  AllActionsConfigs,
  AllActionsProxy
} from '@shared/actions/types'
import { getLocaleFromVSCodeLocale } from '@shared/localize'
import * as vscode from 'vscode'

import { BaseRegister } from './base-register'
import type { RegisterManager } from './register-manager'

export class ActionRegister extends BaseRegister {
  serverActionManager!: ServerActionManager<Record<string, any>, any>

  disposables: vscode.Disposable[] = []

  constructor(
    protected context: vscode.ExtensionContext,
    protected registerManager: RegisterManager,
    protected commandManager: CommandManager
  ) {
    super(context, registerManager, commandManager)
  }

  async register(): Promise<void> {
    this.serverActionManager = createServerActionManager(
      this.context,
      this.registerManager,
      this.commandManager
    )

    await this.serverActionManager.init()

    this.disposables.push(
      vscode.window.onDidChangeWindowState(async () => {
        const currentLanguage = await globalSettingsDB.getSetting('language')
        const newLanguage = getLocaleFromVSCodeLocale(vscode.env.language)

        if (newLanguage && currentLanguage && currentLanguage !== newLanguage) {
          await this.actions().server.settings.changeLanguage({
            actionParams: { language: newLanguage }
          })
        }
      })
    )
  }

  execute<
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
    onStream?: Context['actionType'] extends 'client'
      ? (result: Result) => void
      : never
  ): Result {
    return this.serverActionManager.execute(context, onStream) as Result
  }

  actions(): AllActionsProxy {
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
                        >
                      ) =>
                        this.serverActionManager.execute({
                          ...context,
                          actionType,
                          actionCategory,
                          actionName
                        })
                  }
                )
            }
          )
      }
    ) as AllActionsProxy

    return proxy
  }

  dispose(): void {
    this.serverActionManager.dispose()
    this.disposables.forEach(disposable => disposable.dispose())
    this.disposables = []
  }
}

// const r = new ActionRegister()
// r.actions().client.chatUI.updateConversationUIState({})
// const a = await r.execute(
//   {
//     actionType: 'server',
//     actionCategory: 'apply',
//     actionName: 'applyCode',
//     actionParams: {
//       cleanLast: true,
//       code: 'console.log("hello")',
//       path: 'test.ts'
//     }
//   }
//   // result => {
//   //   console.log(result)
//   // }
// )

// const b = r.actions().server.apply.applyCode(
//   {
//     actionParams: {
//       cleanLast: true,
//       code: 'console.log("hello")',
//       path: 'test.ts'
//     }
//   },
//   result => {
//     console.log(result)
//   }
// )

// const c = r.actions().server.file.resolveVscodeFullFilePath({
//   actionParams: {
//     path: 'test.ts'
//   }
// })
