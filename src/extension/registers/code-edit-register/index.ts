import type { CommandManager } from '@extension/commands/command-manager'
import * as vscode from 'vscode'

import { BaseRegister } from '../base-register'
import type { RegisterManager } from '../register-manager'
import { CodeEditProvider } from './code-edit-provider'

export class CodeEditRegister extends BaseRegister {
  private disposables: vscode.Disposable[] = []

  codeEditProvider!: CodeEditProvider

  constructor(
    protected context: vscode.ExtensionContext,
    protected registerManager: RegisterManager,
    protected commandManager: CommandManager
  ) {
    super(context, registerManager, commandManager)
  }

  async register(): Promise<void> {
    this.codeEditProvider = new CodeEditProvider()
    this.disposables.push(this.codeEditProvider)
  }

  dispose() {
    this.disposables.forEach(d => d.dispose())
    this.disposables = []
  }
}
