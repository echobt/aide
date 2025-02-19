import { v4 as uuidv4 } from 'uuid'

import { BaseEntity, type IBaseEntity } from './base-entity'

export interface DocSite extends IBaseEntity {
  name: string
  url: string
  isCrawled: boolean
  lastCrawledAt?: number
  isIndexed: boolean
  lastIndexedAt?: number
}

export class DocSiteEntity extends BaseEntity<DocSite> {
  protected getDefaults(override?: Partial<DocSite>): DocSite {
    return {
      id: uuidv4(),
      name: '',
      url: '',
      isCrawled: false,
      isIndexed: false,
      lastCrawledAt: undefined,
      lastIndexedAt: undefined,
      ...override
    }
  }
}
