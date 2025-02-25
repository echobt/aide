import path from 'path'
import { workspaceSettingsDB } from '@extension/lowdb/settings-db'
import { getWorkspaceFolder } from '@extension/utils'
import { settledPromiseResults } from '@shared/utils/common'
import { SchemeUriHelper } from '@shared/utils/scheme-uri-helper'

import { vfs } from './vfs'

export const getRulesForAiConfigFromUserFiles = async () => {
  try {
    const workspaceFolder = await getWorkspaceFolder()
    const workspacePath = workspaceFolder.uri.fsPath

    const aideRulesPath = path.join(workspacePath, '.aiderules')
    const cursorRulesPath = path.join(workspacePath, '.cursorrules')
    const continueRulesPath = path.join(workspacePath, '.continuerules')

    const contents = await settledPromiseResults(
      [
        vfs.promises.readFile(aideRulesPath, 'utf-8'),
        vfs.promises.readFile(cursorRulesPath, 'utf-8'),
        vfs.promises.readFile(continueRulesPath, 'utf-8')
      ],
      () => {}
    )

    return contents.join('\n')
  } catch (error) {
    return ''
  }
}

export const getGitIgnoreContentFromUserFiles = async (
  dirSchemeUri: string
) => {
  try {
    const respectGitIgnore =
      await workspaceSettingsDB.getSetting('respectGitIgnore')
    const gitIgnoreSchemeUri = SchemeUriHelper.join(dirSchemeUri, '.gitignore')

    const aideIgnoreSchemeUri = SchemeUriHelper.join(
      dirSchemeUri,
      '.aideignore'
    )

    // cursor.com
    const cursorIgnoreSchemeUri = SchemeUriHelper.join(
      dirSchemeUri,
      '.cursorignore'
    )

    // continue.dev
    const continueIgnoreSchemeUri = SchemeUriHelper.join(
      dirSchemeUri,
      '.continueignore'
    )

    const contents = await settledPromiseResults(
      [
        respectGitIgnore
          ? vfs.promises.readFile(gitIgnoreSchemeUri, 'utf-8')
          : Promise.resolve(''),
        vfs.promises.readFile(aideIgnoreSchemeUri, 'utf-8'),
        vfs.promises.readFile(cursorIgnoreSchemeUri, 'utf-8'),
        vfs.promises.readFile(continueIgnoreSchemeUri, 'utf-8')
      ],
      () => {}
    )

    return contents.join('\n')
  } catch (error) {
    return ''
  }
}
