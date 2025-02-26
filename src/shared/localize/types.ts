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
export type Locale = 'en' | 'zh-cn' | ''

/**
 * Maps VSCode language identifiers to our application's locale
 * See: https://code.visualstudio.com/docs/languages/identifiers#_known-language-identifiers
 * Default mapping from VSCode language identifiers to our application's locale
 */
export const vscodeLocaleMap: Record<string, Locale> = {
  // English
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  'en-au': 'en',
  'en-ca': 'en',

  // Chinese
  'zh-cn': 'zh-cn',
  'zh-hans': 'zh-cn',
  'zh-chs': 'zh-cn',
  'zh-sg': 'zh-cn',

  // Default to English for other languages
  default: 'en'
}

export interface LocaleResource {
  [key: string]: string | LocaleResource
}

export interface LocaleResources {
  [locale: string]: LocaleConfig
}

export interface I18nNamespaces {
  extension: string
  webview: string
}
