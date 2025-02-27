import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import { InternalConfigEntity, type InternalConfig } from '@shared/entities'
import { t } from 'i18next'

import { BaseDB } from './_base'

class InternalConfigDB extends BaseDB<InternalConfig> {
  static readonly schemaVersion = 1

  async init() {
    await this.initConfig({
      filePath: path.join(
        await aidePaths.getWorkspaceLowdbPath(),
        'internal-config.json'
      ),
      currentVersion: InternalConfigDB.schemaVersion
    })
  }

  getDefaults(): Partial<InternalConfig> {
    return new InternalConfigEntity(t).entity
  }

  async getConfig(): Promise<InternalConfig> {
    const configs = await this.getAll()
    if (configs.length === 0) {
      return await this.add(this.getDefaults() as InternalConfig)
    }
    return configs[0]!
  }

  async updateConfig(
    updates: Partial<InternalConfig>
  ): Promise<InternalConfig> {
    const config = await this.getConfig()
    return (await this.update(config.id, updates)) as InternalConfig
  }
}

export const internalConfigDB = new InternalConfigDB()
