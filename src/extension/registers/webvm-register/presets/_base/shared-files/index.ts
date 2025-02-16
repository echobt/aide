import type { WebVMFiles } from '@extension/registers/webvm-register/types'

import { placeholderSvg } from './svg/placeholder'

export const commonPresetFiles: WebVMFiles = [
  {
    relativePathOrSchemeUri: 'public/placeholder.svg',
    content: placeholderSvg
  }
]
