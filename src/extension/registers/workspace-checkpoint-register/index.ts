import type { CommandManager } from '@extension/commands/command-manager'
import { getWorkspaceFolder } from '@extension/utils'
import * as vscode from 'vscode'

import { BaseRegister } from '../base-register'
import type { RegisterManager } from '../register-manager'
import { WorkspaceCheckpoint } from './workspace-checkpoint'

export class WorkspaceCheckpointRegister extends BaseRegister {
  workspaceCheckpoint!: WorkspaceCheckpoint

  constructor(
    protected context: vscode.ExtensionContext,
    protected registerManager: RegisterManager,
    protected commandManager: CommandManager
  ) {
    super(context, registerManager, commandManager)
  }

  async register(): Promise<void> {
    const workspaceFolder = getWorkspaceFolder()

    this.workspaceCheckpoint = await WorkspaceCheckpoint.create(
      workspaceFolder.uri.fsPath
    )
  }

  dispose(): void {
    this.workspaceCheckpoint.dispose()
  }
}
