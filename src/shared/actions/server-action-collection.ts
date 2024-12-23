import type { CommandManager } from '@extension/commands/command-manager'
import type { RegisterManager } from '@extension/registers/register-manager'

import type { ActionExecutor } from './types'

export abstract class ServerActionCollection {
  abstract readonly categoryName: string

  protected registerManager: RegisterManager

  protected commandManager: CommandManager

  constructor(
    registerManager: RegisterManager,
    commandManager: CommandManager
  ) {
    this.registerManager = registerManager
    this.commandManager = commandManager
  }

  [actionName: string]:
    | ActionExecutor<Record<string, any>, any>
    | string
    | unknown
    | undefined
}

export type ServerActionCollectionClass = new (
  ...args: ConstructorParameters<typeof ServerActionCollection>
) => ServerActionCollection
