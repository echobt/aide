import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import { ChatSessionEntity, type ChatSession } from '@shared/entities'

import { BaseDB } from './_base'

class ChatSessionsDB extends BaseDB<ChatSession> {
  static readonly schemaVersion = 1

  async init() {
    await this.initConfig({
      filePath: path.join(
        await aidePaths.getWorkspaceLowdbPath(),
        'sessions.json'
      ),
      currentVersion: ChatSessionsDB.schemaVersion
    })
  }

  getDefaults(): Partial<ChatSession> {
    return new ChatSessionEntity().entity
  }

  async search(query: string): Promise<ChatSession[]> {
    const sessions = await this.getAll()
    return sessions.filter(session =>
      session.title.toLowerCase().includes(query.toLowerCase())
    )
  }
}

export const chatSessionsDB = new ChatSessionsDB()
