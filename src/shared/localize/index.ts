import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from './locales/en'
import zhCn from './locales/zh-cn'
import { getLocaleFromVSCodeLocale, Locale, LocaleResources } from './types'

// Combine all resources
const resources: LocaleResources = {
  en: {
    translation: en
  },
  zhCn: {
    translation: zhCn
  }
}

/**
 * Initialize i18next for both extension and webview
 * @param locale Current locale
 * @param namespace Namespace to use (extension or webview)
 */
export const initI18n = async (locale?: Locale) => {
  await i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      lng: locale,
      fallbackLng: 'en',
      debug: true,
      interpolation: {
        escapeValue: false // React already escapes values
      },
      react: {
        useSuspense: true
      }
    })

  return i18next
}

/**
 * Change language
 * @param locale New locale
 */
export const changeLanguage = async (
  locale: Locale,
  vscodeLang?: string
): Promise<void> => {
  if (!locale) {
    // follow vscode language
    await i18next.changeLanguage(getLocaleFromVSCodeLocale(vscodeLang || ''))
  } else {
    await i18next.changeLanguage(locale)
  }
}

// export const getCurrentLanguage = (): string => i18next.language

// export default i18next
