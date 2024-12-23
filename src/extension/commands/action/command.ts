import { ActionRegister } from '@extension/registers/action-register'
import type { AllActionsConfigs } from '@shared/actions/types'

import { BaseCommand } from '../base.command'

export class ActionCommand extends BaseCommand {
  get commandName(): string {
    return 'aide.action'
  }

  run<
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
    const actionRegister =
      this.commandManager.registerManager.getRegister(ActionRegister)

    if (!actionRegister) throw new Error('ActionRegister not found')

    return actionRegister.execute(context, onStream as any) as Result
  }
}
