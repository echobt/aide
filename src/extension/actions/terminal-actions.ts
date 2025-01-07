import {
  TerminalWatcherRegister,
  type TerminalInfo
} from '@extension/registers/terminal-watcher-register'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'

export class TerminalActionsCollection extends ServerActionCollection {
  readonly categoryName = 'terminal'

  private get terminalWatcher() {
    return this.registerManager.getRegister(TerminalWatcherRegister)
  }

  async getTerminalsForMention(
    context: ActionContext<{}>
  ): Promise<TerminalInfo[]> {
    return this.terminalWatcher?.getAllTerminalInfos() || []
  }

  async runTerminalCommand(
    context: ActionContext<{
      command: string
      isBackground: boolean
    }>
  ) {
    // TODO: Implement this
    return {
      output: '',
      exitCode: 0,
      terminalInfo: null
    }
  }
}
