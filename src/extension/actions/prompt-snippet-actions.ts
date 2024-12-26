import { logger } from '@extension/logger'
import {
  promptSnippetsGlobalDB,
  promptSnippetsWorkspaceDB
} from '@extension/lowdb/prompt-snippets-db'
import { runAction } from '@extension/state'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { PromptSnippet, SettingsSaveType } from '@shared/entities'
import { settledPromiseResults } from '@shared/utils/common'
import { v4 as uuidv4 } from 'uuid'

export type PromptSnippetWithSaveType = PromptSnippet & {
  saveType: SettingsSaveType
}

export class PromptSnippetActionsCollection extends ServerActionCollection {
  readonly categoryName = 'promptSnippet'

  async refreshSnippet(
    context: ActionContext<{ snippet: PromptSnippet }>
  ): Promise<PromptSnippet> {
    const { snippet } = context.actionParams
    const { richText, mentions } = await runAction(
      this.registerManager
    ).server.mention.getUpdatedRichTextMentions({
      actionParams: { richText: snippet.richText || '' }
    })

    return {
      ...snippet,
      richText,
      mentions
    }
  }

  async getSnippets<
    WithSaveType extends boolean,
    Result extends WithSaveType extends true
      ? PromptSnippetWithSaveType[]
      : PromptSnippet[]
  >(
    context: ActionContext<{
      isRefresh?: boolean
      withSaveType?: WithSaveType
      keyword?: string
    }>
  ): Promise<Result> {
    try {
      const { isRefresh, withSaveType, keyword } = context.actionParams

      const getSnippetsFromDB = async () => {
        let oldSnippets: PromptSnippet[] = []

        if (withSaveType) {
          oldSnippets = [
            ...(await promptSnippetsGlobalDB.getAll()).map(snippet => ({
              ...snippet,
              saveType: 'global' as const
            })),
            ...(await promptSnippetsWorkspaceDB.getAll()).map(snippet => ({
              ...snippet,
              saveType: 'workspace' as const
            }))
          ]
        } else {
          oldSnippets = [
            ...(await promptSnippetsGlobalDB.getAll()),
            ...(await promptSnippetsWorkspaceDB.getAll())
          ]
        }

        if (!isRefresh) return oldSnippets as Result

        const updatedSnippets = await settledPromiseResults(
          oldSnippets.map(async snippet =>
            this.refreshSnippet({
              ...context,
              actionParams: { snippet }
            })
          )
        )

        return updatedSnippets as Result
      }

      const snippets = await getSnippetsFromDB()

      if (!keyword?.trim()) return snippets

      const lowerQuery = keyword.toLowerCase()

      return snippets.filter(snippet => {
        // Search in text contents
        const hasMatchInContents = snippet.contents.some(content => {
          if (content.type === 'text') {
            return content.text.toLowerCase().includes(lowerQuery)
          }
          return false
        })

        // Search in title
        const hasMatchInTitle = snippet.title.toLowerCase().includes(lowerQuery)

        return hasMatchInContents || hasMatchInTitle
      }) as Result
    } catch (error) {
      logger.error('Failed to get snippets:', error)
      throw error
    }
  }

  async getSnippet<
    WithSaveType extends boolean,
    Result extends WithSaveType extends true
      ? PromptSnippetWithSaveType
      : PromptSnippet
  >(
    context: ActionContext<{
      id: string
      withSaveType?: WithSaveType
      isRefresh?: boolean
    }>
  ) {
    const { actionParams } = context
    const { id, withSaveType, isRefresh } = actionParams

    const snippets = await this.getSnippets({
      ...context,
      actionParams: { isRefresh, withSaveType }
    })

    return snippets.find(snippet => snippet.id === id) as Result
  }

  async duplicateSnippetById(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    const { id } = actionParams
    const snippet = await this.getSnippet({
      ...context,
      actionParams: { id, isRefresh: true }
    })

    if (!snippet) throw new Error('Snippet not found')

    const newSnippet = await this.addSnippet({
      ...context,
      actionParams: {
        snippet: {
          ...snippet,
          title: `${snippet.title} (Copy)`,
          id: uuidv4()
        },
        saveType: 'workspace'
      }
    })

    return newSnippet
  }

  async addSnippet(
    context: ActionContext<{
      snippet: Omit<PromptSnippet, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string
      }
      saveType: SettingsSaveType
      isRefresh?: boolean
    }>
  ) {
    const { actionParams } = context
    const { saveType, snippet, isRefresh } = actionParams

    try {
      const now = Date.now()
      let updatedSnippet = {
        ...snippet,
        id: snippet.id || uuidv4(),
        createdAt: now,
        updatedAt: now
      }

      if (isRefresh) {
        updatedSnippet = await this.refreshSnippet({
          ...context,
          actionParams: { snippet: updatedSnippet }
        })
      }

      let result

      if (saveType === 'global') {
        result = await promptSnippetsGlobalDB.add(updatedSnippet)
      } else {
        result = await promptSnippetsWorkspaceDB.add(updatedSnippet)
      }

      return result
    } catch (error) {
      logger.error('Failed to add snippet:', error)
      throw error
    }
  }

  async updateSnippet(
    context: ActionContext<{
      id: string
      updates: Partial<Omit<PromptSnippet, 'id' | 'createdAt' | 'updatedAt'>>
      isRefresh?: boolean
    }>
  ) {
    const { actionParams } = context
    const { id, updates, isRefresh } = actionParams
    try {
      const originalSnippet = await this.getSnippet({
        ...context,
        actionParams: { id, isRefresh }
      })

      const updatedSnippet = {
        ...originalSnippet,
        ...updates,
        updatedAt: Date.now()
      }

      const result =
        (await promptSnippetsGlobalDB.update(id, updatedSnippet)) ||
        (await promptSnippetsWorkspaceDB.update(id, updatedSnippet))

      if (!result) {
        throw new Error(`Snippet with id ${id} not found`)
      }
      return result
    } catch (error) {
      logger.error('Failed to update snippet:', error)
      throw error
    }
  }

  async removeSnippet(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    const { id } = actionParams
    try {
      await promptSnippetsGlobalDB.remove(id)
      await promptSnippetsWorkspaceDB.remove(id)
    } catch (error) {
      logger.error('Failed to remove snippet:', error)
      throw error
    }
  }

  async removeSnippets(context: ActionContext<{ ids: string[] }>) {
    const { actionParams } = context
    const { ids } = actionParams
    try {
      await promptSnippetsGlobalDB.batchRemove(ids)
      await promptSnippetsWorkspaceDB.batchRemove(ids)
    } catch (error) {
      logger.error('Failed to remove snippets:', error)
      throw error
    }
  }
}
