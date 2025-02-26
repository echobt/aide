import { getOriginalFileUri } from '@extension/file-utils/tmp-file/get-original-file-uri'
import { isTmpFileUri } from '@extension/file-utils/tmp-file/is-tmp-file-uri'
import { t } from 'i18next'
import * as vscode from 'vscode'

import { BaseRegister } from './base-register'

class TmpFileActionCodeLensProvider implements vscode.CodeLensProvider {
  private codeLenses: vscode.CodeLens[] = []

  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>()

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event

  private disposables: vscode.Disposable[] = []

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(_ => {
        this._onDidChangeCodeLenses.fire()
      })
    )
  }

  provideCodeLenses(
    document: vscode.TextDocument
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (!isTmpFileUri(document.uri)) return []

    this.updateCodeLenses(document)
    return this.codeLenses
  }

  private updateCodeLenses(document: vscode.TextDocument): void {
    this.codeLenses = []
    const firstLineRange = new vscode.Range(0, 0, 0, 0)
    const tmpFileUri = document.uri
    const originFileUri = getOriginalFileUri(tmpFileUri)

    const commands: vscode.Command[] = [
      {
        title: `$(close) ${t('extension.command.quickCloseFileWithoutSave')}`,
        command: 'aide.quickCloseFileWithoutSave',
        arguments: [tmpFileUri]
      },
      {
        title: `$(explorer-view-icon) ${t('extension.command.copyFileText')}`,
        command: 'aide.copyFileText',
        arguments: [tmpFileUri]
      },
      {
        title: `$(diff) ${t('extension.command.showDiff')}`,
        command: 'aide.showDiff',
        arguments: [originFileUri, tmpFileUri]
      },
      {
        title: `$(breakpoints-activate) ${t('extension.command.replaceFile')}`,
        command: 'aide.replaceFile',
        arguments: [originFileUri, tmpFileUri]
      }
    ]

    commands.forEach(command => {
      this.codeLenses.push(new vscode.CodeLens(firstLineRange, command))
    })
  }

  dispose(): void {
    this.disposables.forEach(dispose => dispose.dispose())
    this.disposables = []
  }
}

export class TmpFileActionRegister extends BaseRegister {
  private disposables: vscode.Disposable[] = []

  register(): void {
    const tmpFileActionCodeLensProvider = new TmpFileActionCodeLensProvider()

    // register CodeLensProvider, only for file name contains .aide
    this.disposables.push(
      vscode.languages.registerCodeLensProvider(
        { scheme: '*', pattern: '**/*.aide*' },
        tmpFileActionCodeLensProvider
      )
    )

    this.disposables.push(tmpFileActionCodeLensProvider)
  }

  dispose(): void {
    this.disposables.forEach(dispose => dispose.dispose())
    this.disposables = []
  }
}
