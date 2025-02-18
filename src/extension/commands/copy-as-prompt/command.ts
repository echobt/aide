import { getFileOrFoldersPromptInfo } from '@extension/file-utils/get-fs-prompt-info'
import { workspaceSchemeHandler } from '@extension/file-utils/vfs/schemes/workspace-scheme'
import { t } from '@extension/i18n'
import { globalSettingsDB } from '@extension/lowdb/settings-db'
import * as vscode from 'vscode'

import { BaseCommand } from '../base.command'

export class CopyAsPromptCommand extends BaseCommand {
  get commandName(): string {
    return 'aide.copyAsPrompt'
  }

  async run(uri: vscode.Uri, selectedUris: vscode.Uri[] = []): Promise<void> {
    const selectedItems = selectedUris?.length > 0 ? selectedUris : [uri]
    if (selectedItems.length === 0) throw new Error(t('error.noSelection'))

    const selectedFileOrFolderSchemeUris = selectedItems.map(item =>
      workspaceSchemeHandler.createSchemeUri({
        fullPath: item.fsPath
      })
    )
    const { promptFullContent } = await getFileOrFoldersPromptInfo(
      selectedFileOrFolderSchemeUris
    )
    const aiPrompt = await globalSettingsDB.getSetting('aiPrompt')
    const finalPrompt = aiPrompt.replace('#{content}', promptFullContent)

    await vscode.env.clipboard.writeText(finalPrompt)
    vscode.window.showInformationMessage(t('info.copied'))
  }
}
