import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import { Project, ProjectEntity } from '@shared/entities'

import { BaseDB } from './_base'

class ProjectDB extends BaseDB<Project> {
  static readonly schemaVersion = 1

  async init() {
    await this.initConfig({
      filePath: path.join(
        await aidePaths.getGlobalLowdbPath(),
        'projects.json'
      ),
      currentVersion: ProjectDB.schemaVersion
    })
  }

  getDefaults(): Partial<Project> {
    return new ProjectEntity().entity
  }
}

export const projectDB = new ProjectDB()
