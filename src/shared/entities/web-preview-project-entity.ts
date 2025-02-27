import { defaultPresetName } from '@extension/registers/webvm-register/presets/_base/constants'
import type { TFunction } from 'i18next'
import { v4 as uuidv4 } from 'uuid'

import { BaseEntity, type IBaseEntity } from './base-entity'

export interface WebPreviewProjectFile {
  content: string
  path: string
}

export interface WebPreviewProject extends IBaseEntity {
  name: string
  presetName: string
  files: WebPreviewProjectFile[]
}

export class WebPreviewProjectEntity extends BaseEntity<WebPreviewProject> {
  getDefaults(
    t: TFunction,
    override?: Partial<WebPreviewProject>
  ): WebPreviewProject {
    return {
      id: uuidv4(),
      name: 'Unknown Project',
      presetName: defaultPresetName,
      files: [],
      ...override
    }
  }
}
