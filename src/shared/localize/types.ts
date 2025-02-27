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
