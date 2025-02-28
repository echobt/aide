import * as vscode from 'vscode'

import { ChatHistoryManager } from './ai/model-providers/helpers/chat-history-manager'
import { registerCommands } from './commands'
import { CommandManager } from './commands/command-manager'
import { initializeLocalization } from './i18n'
import { logger } from './logger'
import { setupRegisters } from './registers'
import { RegisterManager } from './registers/register-manager'
import { setServerState } from './state'
import { redisStorage, stateStorage } from './storage'

export const activate = async (context: vscode.ExtensionContext) => {
  try {
    logger.log('"Aide" is now active!', {
      dataPath: context.globalStorageUri,
      extensionPath: context.extensionUri
    })

    await initializeLocalization()
    setServerState({ context })

    const commandManager = new CommandManager(context)
    await registerCommands(commandManager)
    setServerState({ commandManager })

    const registerManager = new RegisterManager(context, commandManager)
    await setupRegisters(registerManager)
    commandManager.registerManager = registerManager
    setServerState({ registerManager })
  } catch (err) {
    logger.warn('Failed to activate extension', err)
    throw err
  }
}

export const deactivate = () => {
  // clear the session history map
  ChatHistoryManager.clearAllHistories()

  // clear the state storage
  stateStorage.clear()

  // clear the redis storage
  redisStorage.clear()

  // destroy the logger
  logger.destroy()
}
