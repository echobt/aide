import { globalSettingsDB } from '@extension/lowdb/settings-db'
import * as vscode from 'vscode'

import { initI18n } from '../shared/localize'
import { type Locale } from '../shared/localize/types'

export const initializeLocalization = async (): Promise<void> => {
  let language = ''

  try {
    language =
      (await globalSettingsDB.getSetting('language')) || vscode.env.language
  } catch (error) {
    language = vscode.env.language
  }

  // Initialize i18next with extension namespace
  await initI18n(language as Locale)
}
