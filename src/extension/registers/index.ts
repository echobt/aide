import { ActionRegister } from './action-register'
import { AideKeyUsageStatusBarRegister } from './aide-key-usage-statusbar-register'
import { AutoOpenCorrespondingFilesRegister } from './auto-open-corresponding-files-register'
import { BaseRegister } from './base-register'
import { ChatHistoriesTreeRegister } from './chat-histories-tree-register'
import { CodebaseWatcherRegister } from './codebase-watcher-register'
import { DBRegister } from './db-register'
import { InlineDiffRegister } from './inline-diff-register'
import { ModelRegister } from './model-register'
import { PromptSnippetTreeRegister } from './prompt-snippet-tree-register'
import { RegisterManager } from './register-manager'
import { ServerPluginRegister } from './server-plugin-register'
import { SystemSetupRegister } from './system-setup-register'
import { TerminalWatcherRegister } from './terminal-watcher-register'
import { TmpFileActionRegister } from './tmp-file-action-register'
import { TmpFileSchemaRegister } from './tmp-file-schema-register'
import { WebviewRegister } from './webview-register'

export const setupRegisters = async (registerManager: RegisterManager) => {
  const Registers = [
    DBRegister,
    SystemSetupRegister,
    ActionRegister,
    TmpFileSchemaRegister,
    TmpFileActionRegister,
    AideKeyUsageStatusBarRegister,
    AutoOpenCorrespondingFilesRegister,
    InlineDiffRegister,
    TerminalWatcherRegister,
    ServerPluginRegister,
    WebviewRegister,
    ModelRegister,
    CodebaseWatcherRegister,
    ChatHistoriesTreeRegister,
    PromptSnippetTreeRegister
  ] satisfies (typeof BaseRegister)[]

  for await (const Register of Registers) {
    await registerManager.setupRegister(Register)
  }
}
