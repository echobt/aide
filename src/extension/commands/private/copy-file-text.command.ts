import { t } from 'i18next'
import * as vscode from 'vscode'

import { BaseCommand } from '../base.command'

export class CopyFileTextCommand extends BaseCommand {
  get commandName(): string {
    return 'aide.copyFileText'
  }

  async run(uri?: vscode.Uri): Promise<void> {
    const targetUri = uri || vscode.window.activeTextEditor?.document.uri

    if (!targetUri) throw new Error(t('extension.error.noActiveEditor'))

    const document = await vscode.workspace.openTextDocument(targetUri)
    await vscode.env.clipboard.writeText(document.getText())
    vscode.window.showInformationMessage(t('extension.info.copied'))
  }
}
