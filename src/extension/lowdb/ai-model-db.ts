import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import { AIModelEntity, type AIModel } from '@shared/entities'
import { t } from 'i18next'

import { BaseDB } from './_base'

class AIModelDB extends BaseDB<AIModel> {
  static readonly schemaVersion = 1

  async init() {
    await this.initConfig({
      filePath: path.join(
        await aidePaths.getGlobalLowdbPath(),
        'ai-models.json'
      ),
      currentVersion: AIModelDB.schemaVersion
    })
  }

  getDefaults(): Partial<AIModel> {
    return new AIModelEntity(t).entity
  }
}

export const aiModelDB = new AIModelDB()
