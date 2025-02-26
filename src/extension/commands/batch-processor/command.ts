import { isTmpFileUri } from '@extension/file-utils/tmp-file/is-tmp-file-uri'
import { traverseFileOrFolders } from '@extension/file-utils/traverse-fs'
import { vfs } from '@extension/file-utils/vfs'
import { workspaceSchemeHandler } from '@extension/file-utils/vfs/schemes/workspace-scheme'
import { createLoading } from '@extension/loading'
import { logger } from '@extension/logger'
import { globalSettingsDB } from '@extension/lowdb/settings-db'
import { stateStorage } from '@extension/storage'
import { AbortError, settledPromiseResults } from '@shared/utils/common'
import { t } from 'i18next'
import pLimit from 'p-limit'
import * as vscode from 'vscode'

import { BaseCommand } from '../base.command'
import { getPreProcessInfo } from './get-pre-process-info'
import { writeAndSaveTmpFile } from './write-and-save-tmp-file'

export class BatchProcessorCommand extends BaseCommand {
  get commandName(): string {
    return 'aide.batchProcessor'
  }

  async run(uri: vscode.Uri, selectedUris: vscode.Uri[] = []): Promise<void> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
    if (!workspaceFolder) throw new Error(t('error.noWorkspace'))

    const selectedItems = selectedUris?.length > 0 ? selectedUris : [uri]
    if (selectedItems.length === 0) throw new Error(t('error.noSelection'))

    const selectedFileOrFolderSchemeUris = selectedItems.map(item =>
      workspaceSchemeHandler.createSchemeUri({
        fullPath: item.fsPath
      })
    )

    const filesInfo = await traverseFileOrFolders({
      type: 'file',
      schemeUris: selectedFileOrFolderSchemeUris,
      itemCallback: fileInfo => fileInfo
    })

    const isIgnoreFile = async (schemeUri: string) => {
      const fullPath = await vfs.resolveFullPathProAsync(schemeUri, false)
      return isTmpFileUri(vscode.Uri.file(fullPath))
    }

    const fileRelativePathsForProcess = (
      await settledPromiseResults(
        filesInfo.map(async fileInfo => {
          if (await isIgnoreFile(fileInfo.schemeUri)) return null
          return vfs.resolveRelativePathProSync(fileInfo.schemeUri)
        })
      )
    ).filter(Boolean) as string[]

    // show input box
    const prompt = await vscode.window.showInputBox({
      prompt: t('input.batchProcessor.prompt', {
        filesCount: fileRelativePathsForProcess.length
      }),
      placeHolder: t('input.batchProcessor.placeholder'),
      value: stateStorage.getItem('batchProcessorLastPrompt') || ''
    })

    if (!prompt) return
    stateStorage.setItem('batchProcessorLastPrompt', prompt)

    const abortController = new AbortController()
    const { showProcessLoading, hideProcessLoading } = createLoading()

    try {
      showProcessLoading({
        onCancel() {
          abortController.abort()
        }
      })

      const preProcessInfo = await getPreProcessInfo({
        prompt,
        fileRelativePathsForProcess,
        abortController
      })

      logger.log('handleBatchProcessor', preProcessInfo)

      if (abortController?.signal.aborted) throw AbortError

      const apiConcurrency = await globalSettingsDB.getSetting('apiConcurrency')
      const limit = pLimit(apiConcurrency)
      const promises = preProcessInfo.processFilePathInfo.map(info =>
        limit(() =>
          writeAndSaveTmpFile({
            prompt,
            workspacePath: workspaceFolder.uri.fsPath,
            allFileRelativePaths: preProcessInfo.allFileRelativePaths,
            sourceFileRelativePath: info.sourceFileRelativePath,
            processedFileRelativePath: info.processedFileRelativePath,
            dependenceFileRelativePath:
              preProcessInfo.dependenceFileRelativePath,
            abortController
          }).catch(err => logger.warn('writeAndSaveTmpFile error', err))
        )
      )

      await settledPromiseResults(promises)

      hideProcessLoading()

      await vscode.window.showInformationMessage(
        t('info.batchProcessorSuccess', {
          filesCount: preProcessInfo.processFilePathInfo.length,
          tasks: prompt
        })
      )
    } finally {
      hideProcessLoading()
    }
  }
}
