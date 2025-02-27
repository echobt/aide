import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import {
  PromptSnippetEntity,
  type EntitySaveType,
  type PromptSnippet
} from '@shared/entities'
import { t } from 'i18next'

import { BaseDB } from './_base'

class PromptSnippetsDB extends BaseDB<PromptSnippet> {
  static readonly schemaVersion = 1

  private saveType: EntitySaveType

  constructor(saveType: EntitySaveType) {
    super()
    this.saveType = saveType
  }

  async init() {
    const filePath =
      this.saveType === 'global'
        ? await aidePaths.getGlobalLowdbPath()
        : await aidePaths.getWorkspaceLowdbPath()

    await this.initConfig({
      filePath: path.join(filePath, 'prompt-snippets.json'),
      currentVersion: PromptSnippetsDB.schemaVersion
    })
  }

  getDefaults(): Partial<PromptSnippet> {
    return new PromptSnippetEntity(t).entity
  }
}

export const promptSnippetsGlobalDB = new PromptSnippetsDB('global')

export const promptSnippetsWorkspaceDB = new PromptSnippetsDB('workspace')
