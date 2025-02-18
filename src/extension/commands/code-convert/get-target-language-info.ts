import { t } from '@extension/i18n'
import {
  globalSettingsDB,
  workspaceSettingsDB
} from '@extension/lowdb/settings-db'
import { showQuickPickWithCustomInput } from '@extension/utils'
import {
  getLanguageId,
  getLanguageIdExt,
  languageIdExts,
  languageIds
} from '@shared/utils/vscode-lang'

/**
 * Get target language info
 * if user input custom language like: vue please convert to vue3
 * return { targetLanguageId: 'vue', targetLanguageDescription: 'please convert to vue3' }
 */
export const getTargetLanguageInfo = async (originalFileLanguageId: string) => {
  const convertLanguagePairs = await workspaceSettingsDB.getSetting(
    'convertLanguagePairs'
  )
  let targetLanguageInfo = convertLanguagePairs?.[originalFileLanguageId] || ''

  if (!targetLanguageInfo) {
    targetLanguageInfo = await showQuickPickWithCustomInput({
      items: [...languageIds, ...languageIdExts],
      placeholder: t('input.codeConvertTargetLanguage.prompt')
    })

    if (!targetLanguageInfo) throw new Error(t('error.noTargetLanguage'))

    const autoRememberConvertLanguagePairs = await globalSettingsDB.getSetting(
      'autoRememberConvertLanguagePairs'
    )

    if (autoRememberConvertLanguagePairs) {
      await workspaceSettingsDB.setSetting('convertLanguagePairs', {
        ...convertLanguagePairs,
        [originalFileLanguageId]: targetLanguageInfo
      })
    }
  }

  const [targetLanguageIdOrExt = 'plaintext', ...targetLanguageRest] =
    targetLanguageInfo.split(/\s+/)
  const targetLanguageDescription = targetLanguageRest.join(' ')
  const targetLanguageId = getLanguageId(targetLanguageIdOrExt)

  return {
    targetLanguageId: targetLanguageId || targetLanguageInfo,
    targetLanguageExt: getLanguageIdExt(targetLanguageIdOrExt),
    targetLanguageDescription: targetLanguageDescription?.trim() || ''
  }
}
