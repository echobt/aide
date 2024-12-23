import * as vscode from 'vscode'

import type { CommandManager } from './commands/command-manager'
import { ActionRegister } from './registers/action-register'
import { RegisterManager } from './registers/register-manager'

export interface ServerState {
  context: vscode.ExtensionContext | null
  registerManager: RegisterManager | null
  commandManager: CommandManager | null
}

export const serverState: ServerState = {
  context: null,
  registerManager: null,
  commandManager: null
}

export const setServerState = (state: Partial<ServerState>) => {
  Object.assign(serverState, state)
}

export const runAction = (_registerManager?: RegisterManager) => {
  const registerManager = _registerManager || serverState.registerManager

  if (!registerManager) throw new Error('RegisterManager is not set')

  const actionRegister = registerManager.getRegister(ActionRegister)
  return actionRegister?.actions()
}
