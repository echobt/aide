import type { AideWebViewProvider } from '@extension/registers/webview-register/webview-provider'
import { t } from 'i18next'

import { BaseCommand } from '../base.command'

export class OpenWebviewCommand extends BaseCommand {
  get commandName(): string {
    return 'aide.openWebview'
  }

  async run(): Promise<void> {
    const aideWebViewProvider = this.commandManager.getService(
      'AideWebViewProvider'
    ) as AideWebViewProvider

    if (aideWebViewProvider) {
      await aideWebViewProvider.createOrShowWebviewPanel()
    } else {
      throw new Error(
        t('extension.commands.openWebview.errors.providerNotFound')
      )
    }
  }
}
