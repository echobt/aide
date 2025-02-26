import type { LocaleConfig } from '@shared/localize/types'

import extension from './extension'
import shared from './shared'
import webview from './webview'

export default {
  extension,
  webview,
  shared
} satisfies LocaleConfig
