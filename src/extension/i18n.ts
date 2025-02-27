import { globalSettingsDB } from '@extension/lowdb/settings-db'
import * as vscode from 'vscode'

import { getLocaleFromVSCodeLocale, initI18n } from '../shared/localize'
import { type Locale } from '../shared/localize/types'

export const initializeLocalization = async (): Promise<void> => {
  let language = ''
  const localeFromVSCode = getLocaleFromVSCodeLocale(vscode.env.language)

  try {
    language =
      (await globalSettingsDB.getSetting('language')) || localeFromVSCode
  } catch (error) {
    language = localeFromVSCode
  }

  // Initialize i18next with extension namespace
  await initI18n(language as Locale)
}
