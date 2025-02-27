import type { TFunction } from 'i18next'
import { v4 as uuidv4 } from 'uuid'

import { BaseEntity, type IBaseEntity } from './base-entity'

export interface Project extends IBaseEntity {
  name: string
  description: string
  path: string
  createdAt: number
  updatedAt: number
}

export class ProjectEntity extends BaseEntity<Project> {
  protected getDefaults(t: TFunction, override?: Partial<Project>): Project {
    const now = Date.now()

    return {
      id: uuidv4(),
      name: '',
      description: '',
      path: '',
      createdAt: now,
      updatedAt: now,
      ...override
    }
  }
}
