import type { TFunction } from 'i18next'

export type EntitySaveType = 'global' | 'workspace'

export interface IBaseEntity {
  id: string
  schemaVersion?: number
}

export abstract class BaseEntity<T extends IBaseEntity> {
  entity: T

  constructor(t: TFunction, override?: Partial<T>) {
    this.entity = { ...this.getDefaults(t, override || {}) }
  }

  protected abstract getDefaults(t: TFunction, override?: Partial<T>): T
}
