import type { TFunction } from 'i18next'
import { v4 as uuidv4 } from 'uuid'

import { BaseEntity, type IBaseEntity } from './base-entity'

export type GitProjectType = 'github' | 'gitlab' | 'bitbucket'

export interface GitProject extends IBaseEntity {
  type: GitProjectType
  name: string
  description: string
  repoUrl: string
  createdAt: number
  updatedAt: number
}

export class GitProjectEntity extends BaseEntity<GitProject> {
  protected getDefaults(
    t: TFunction,
    override?: Partial<GitProject>
  ): GitProject {
    const now = Date.now()
    return {
      id: uuidv4(),
      type: 'github',
      name: '',
      description: '',
      repoUrl: '',
      createdAt: now,
      updatedAt: now,
      ...override
    }
  }
}
