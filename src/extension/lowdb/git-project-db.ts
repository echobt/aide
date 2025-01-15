import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import { GitProject, GitProjectEntity } from '@shared/entities'

import { BaseDB } from './_base'

class GitProjectDB extends BaseDB<GitProject> {
  static readonly schemaVersion = 1

  async init() {
    await this.initConfig({
      filePath: path.join(
        await aidePaths.getGlobalLowdbPath(),
        'git-projects.json'
      ),
      currentVersion: GitProjectDB.schemaVersion
    })
  }

  getDefaults(): Partial<GitProject> {
    return new GitProjectEntity().entity
  }
}

export const gitProjectDB = new GitProjectDB()
