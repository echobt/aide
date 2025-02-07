import type { CommandManager } from '@extension/commands/command-manager'
import * as vscode from 'vscode'

import { BaseRegister } from '../base-register'
import type { RegisterManager } from '../register-manager'
import { VSCodeDiffProvider } from './vscode-diff-provider'

export class VSCodeDiffRegister extends BaseRegister {
  private disposables: vscode.Disposable[] = []

  inlineDiffProvider!: VSCodeDiffProvider // keep the same interface name as inline-diff-register

  constructor(
    protected context: vscode.ExtensionContext,
    protected registerManager: RegisterManager,
    protected commandManager: CommandManager
  ) {
    super(context, registerManager, commandManager)
  }

  async register(): Promise<void> {
    this.inlineDiffProvider = new VSCodeDiffProvider()
    this.disposables.push(this.inlineDiffProvider)
  }

  async dispose() {
    this.disposables.forEach(disposable => disposable.dispose())
    this.disposables = []
  }
}
