import enExtension from './locales/en/extension'
import enShared from './locales/en/shared'
import enWebview from './locales/en/webview'

export type ExtensionLocaleConfig = typeof enExtension

export type WebviewLocaleConfig = typeof enWebview

export type SharedLocaleConfig = typeof enShared

export type LocaleConfig = {
  extension: ExtensionLocaleConfig
  webview: WebviewLocaleConfig
  shared: SharedLocaleConfig
}

// Types for i18n
export type Locale = 'en' | 'zhCn' | ''

/**
 * Maps VSCode language to our application's locale
 * Default mapping from VSCode language to our application's locale
 */
const vscodeLocaleMap: Record<string, Locale> = {
  // English
  en: 'en',
  'en-US': 'en',
  'en-GB': 'en',
  'en-AU': 'en',
  'en-CA': 'en',

  // Chinese
  'zh-CN': 'zhCn',
  'zh-Hans': 'zhCn',
  'zh-Hans-CN': 'zhCn',
  'zh-SG': 'zhCn',

  // Default to English for other languages
  default: 'en'
}

export const getLocaleFromVSCodeLocale = (vscodeLocale: string) =>
  Object.entries(vscodeLocaleMap).find(([key]) =>
    vscodeLocale.toLowerCase().includes(key.toLowerCase())
  )?.[1] || 'en'

export interface LocaleResource {
  [key: string]: string | LocaleResource
}

export interface LocaleResources {
  [locale: string]: {
    translation: LocaleResource
  }
}

export interface I18nNamespaces {
  extension: string
  webview: string
}
