import type { TFunction } from 'i18next'
import { v4 as uuidv4 } from 'uuid'

import { BaseEntity, type IBaseEntity } from './base-entity'

export interface InternalConfig extends IBaseEntity {
  lastCodebaseIndexTime?: number
  lastCodebaseIndexCompleted: boolean
}

export class InternalConfigEntity extends BaseEntity<InternalConfig> {
  protected getDefaults(
    t: TFunction,
    override?: Partial<InternalConfig>
  ): InternalConfig {
    return {
      id: uuidv4(),
      lastCodebaseIndexTime: undefined,
      lastCodebaseIndexCompleted: false,
      ...override
    }
  }
}
