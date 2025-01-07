export type EntitySaveType = 'global' | 'workspace'

export interface IBaseEntity {
  id: string
  schemaVersion?: number
}

export abstract class BaseEntity<T extends IBaseEntity> {
  entity: T

  constructor(override?: Partial<T>) {
    this.entity = { ...this.getDefaults(override || {}) }
  }

  protected abstract getDefaults(override?: Partial<T>): T
}
