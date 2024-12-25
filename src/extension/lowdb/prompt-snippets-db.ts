import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import { PromptSnippetEntity, type PromptSnippet } from '@shared/entities'

import { BaseDB } from './base-db'

class PromptSnippetsDB extends BaseDB<PromptSnippet> {
  static readonly schemaVersion = 1

  constructor(dbFilePath: string) {
    super(dbFilePath, PromptSnippetsDB.schemaVersion)
  }

  getDefaults(): Partial<PromptSnippet> {
    return new PromptSnippetEntity().entity
  }
}

export const promptSnippetsGlobalDB = new PromptSnippetsDB(
  path.join(aidePaths.getGlobalLowdbPath(), 'prompt-snippets.json')
)

export const promptSnippetsWorkspaceDB = new PromptSnippetsDB(
  path.join(aidePaths.getWorkspaceLowdbPath(), 'prompt-snippets.json')
)
