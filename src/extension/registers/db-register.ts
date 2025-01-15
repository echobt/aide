import type { CommandManager } from '@extension/commands/command-manager'
import { dbList } from '@extension/lowdb'
import * as vscode from 'vscode'

import { BaseRegister } from './base-register'
import type { RegisterManager } from './register-manager'

export class DBRegister extends BaseRegister {
  constructor(
    protected context: vscode.ExtensionContext,
    protected registerManager: RegisterManager,
    protected commandManager: CommandManager
  ) {
    super(context, registerManager, commandManager)
  }

  async register(): Promise<void> {
    await Promise.all(dbList.map(db => db.init()))
  }

  dispose(): void {
    dbList.forEach(db => db.dispose())
  }
}
