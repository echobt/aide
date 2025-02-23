import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import { McpEntity, type McpConfig } from '@shared/entities'

import { BaseDB } from './_base'

class McpDB extends BaseDB<McpConfig> {
  static readonly schemaVersion = 1

  async init() {
    await this.initConfig({
      filePath: path.join(
        await aidePaths.getGlobalLowdbPath(),
        'mcp-configs.json'
      ),
      currentVersion: McpDB.schemaVersion
    })
  }

  getDefaults(): Partial<McpConfig> {
    return new McpEntity().entity
  }

  async updateStatus(
    id: string,
    updates: {
      isEnabled?: boolean
    }
  ): Promise<McpConfig | null> {
    return this.update(id, updates)
  }
}

export const mcpDB = new McpDB()
