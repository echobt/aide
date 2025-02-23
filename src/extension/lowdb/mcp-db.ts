import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import { MCPEntity, type MCPConfig } from '@shared/entities'

import { BaseDB } from './_base'

class MCPDB extends BaseDB<MCPConfig> {
  static readonly schemaVersion = 1

  async init() {
    await this.initConfig({
      filePath: path.join(
        await aidePaths.getGlobalLowdbPath(),
        'mcp-configs.json'
      ),
      currentVersion: MCPDB.schemaVersion
    })
  }

  getDefaults(): Partial<MCPConfig> {
    return new MCPEntity().entity
  }

  async updateStatus(
    id: string,
    updates: {
      isEnabled?: boolean
    }
  ): Promise<MCPConfig | null> {
    return this.update(id, updates)
  }
}

export const mcpDB = new MCPDB()
