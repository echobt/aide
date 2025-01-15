import { aidePaths } from '@extension/file-utils/paths'
import { vfs } from '@extension/file-utils/vfs'
import { logger } from '@extension/logger'
import { chatSessionsDB } from '@extension/lowdb/chat-sessions-db'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import {
  ChatContextEntity,
  type ChatContext,
  type ChatSession,
  type Conversation
} from '@shared/entities'
import { settledPromiseResults } from '@shared/utils/common'
import { v4 as uuidv4 } from 'uuid'

export class ChatSessionActionsCollection extends ServerActionCollection {
  readonly categoryName = 'chatSession'

  private async getSessionFilePath(sessionId: string): Promise<string> {
    return await aidePaths.getSessionFilePath(sessionId)
  }

  async createSession(
    context: ActionContext<{ chatContext: ChatContext }>
  ): Promise<ChatSession> {
    const { actionParams } = context
    const { chatContext } = actionParams
    const chatSession = new ChatContextEntity(chatContext).toChatSession()
    const now = new Date().getTime()
    const session = await chatSessionsDB.add({
      ...chatSession,
      createdAt: now,
      updatedAt: now
    })

    await vfs.writeJsonFile(await this.getSessionFilePath(session.id), {
      ...chatContext,
      createdAt: now,
      updatedAt: now
    })

    return session
  }

  async getChatContext(
    context: ActionContext<{ sessionId: string }>
  ): Promise<ChatContext | null> {
    const { actionParams } = context
    const { sessionId } = actionParams
    const filePath = await this.getSessionFilePath(sessionId)
    try {
      return await vfs.readJsonFile<ChatContext>(filePath)
    } catch (error) {
      logger.error(`Failed to read session file: ${filePath}`, error)
      return null
    }
  }

  async updateSession(
    context: ActionContext<{ chatContext: ChatContext }>
  ): Promise<void> {
    const { actionParams } = context
    const { chatContext } = actionParams
    const now = new Date().getTime()
    const session = await chatSessionsDB.update(chatContext.id, {
      ...new ChatContextEntity(chatContext).toChatSession(),
      updatedAt: now
    })

    if (session) {
      await vfs.writeJsonFile(await this.getSessionFilePath(session.id), {
        ...chatContext,
        updatedAt: now
      })
    }
  }

  async createOrUpdateSession(
    context: ActionContext<{ chatContext: ChatContext }>
  ): Promise<void> {
    const { actionParams } = context
    const { chatContext } = actionParams
    const now = new Date().getTime()
    const session = await chatSessionsDB.createOrUpdate({
      ...new ChatContextEntity(chatContext).toChatSession(),
      updatedAt: now
    })

    await vfs.writeJsonFile(await this.getSessionFilePath(session.id), {
      ...chatContext,
      updatedAt: now
    })
  }

  async duplicateSessionById(
    context: ActionContext<{ sessionId: string }>
  ): Promise<ChatSession> {
    const { actionParams } = context
    const { sessionId } = actionParams
    const chatContext = await this.getChatContext({
      ...context,
      actionParams: { sessionId }
    })

    if (!chatContext) throw new Error('Session not found')

    const newSession = await this.createSession({
      ...context,
      actionParams: {
        chatContext: {
          ...chatContext,
          id: uuidv4()
        }
      }
    })

    return newSession
  }

  async ensureASessionExists(context: ActionContext<{}>): Promise<void> {
    const sessions = await this.getAllSessions(context)
    if (sessions.length === 0) {
      await this.createSession({
        ...context,
        actionParams: {
          chatContext: new ChatContextEntity().entity
        }
      })
    }
  }

  async deleteSession(
    context: ActionContext<{ sessionId: string }>
  ): Promise<void> {
    const { actionParams } = context
    const { sessionId } = actionParams
    await chatSessionsDB.remove(sessionId)
    await vfs.promises.unlink(await this.getSessionFilePath(sessionId))
  }

  async deleteSessions(
    context: ActionContext<{ sessionIds: string[] }>
  ): Promise<void> {
    const { actionParams } = context
    const { sessionIds } = actionParams
    await chatSessionsDB.batchRemove(sessionIds)
    await settledPromiseResults(
      sessionIds.map(async id =>
        vfs.promises.unlink(await this.getSessionFilePath(id))
      )
    )
  }

  async getAllSessions(context: ActionContext<{}>): Promise<ChatSession[]> {
    return await chatSessionsDB.getAll()
  }

  async searchSessions(
    context: ActionContext<{ query: string }>
  ): Promise<ChatSession[]> {
    const { actionParams } = context
    const { query } = actionParams
    const sessions = await chatSessionsDB.search(query)
    const results: ChatSession[] = []

    for (const session of sessions) {
      const chatContext = await this.getChatContext({
        ...context,
        actionParams: { sessionId: session.id }
      })
      if (
        chatContext &&
        this.searchInConversations(chatContext.conversations, query)
      ) {
        results.push(session)
      }
    }

    return results
  }

  private searchInConversations(
    conversations: Conversation[],
    query: string
  ): boolean {
    return conversations.some(conv =>
      conv.contents.some(
        content =>
          content.type === 'text' &&
          content.text.toLowerCase().includes(query.toLowerCase())
      )
    )
  }
}
