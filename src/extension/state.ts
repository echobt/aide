import * as vscode from 'vscode'

import type { CommandManager } from './commands/command-manager'
import { ActionRegister } from './registers/action-register'
import { RegisterManager } from './registers/register-manager'

export interface ServerState {
  context: vscode.ExtensionContext | null
  registerManager: RegisterManager | null
  commandManager: CommandManager | null
  lastWorkspaceFolder: vscode.WorkspaceFolder | null
}

const serverState: ServerState = {
  context: null,
  registerManager: null,
  commandManager: null,
  lastWorkspaceFolder: null
}

export const getServerState = (): ServerState => serverState

export const setServerState = (state: Partial<ServerState>) => {
  Object.assign(serverState, state)
}

export const runAction = (_registerManager?: RegisterManager) => {
  const registerManager = _registerManager || serverState.registerManager

  if (!registerManager) throw new Error('RegisterManager is not set')

  const actionRegister = registerManager.getRegister(ActionRegister)

  if (!actionRegister) throw new Error('ActionRegister is not set')

  return actionRegister.actions()
}
