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

export type PromptSnippetWithSaveType = PromptSnippet & {
  saveType: SettingsSaveType
}

export class PromptSnippetActionsCollection extends ServerActionCollection {
  readonly categoryName = 'promptSnippet'

  async getSnippets<
    WithSaveType extends boolean,
    Result extends WithSaveType extends true
      ? PromptSnippetWithSaveType[]
      : PromptSnippet[]
  >(
    context: ActionContext<{
      isRefresh?: boolean
      withSaveType?: WithSaveType
    }>
  ): Promise<Result> {
    try {
      const { isRefresh, withSaveType } = context.actionParams

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
        oldSnippets.map(async snippet => {
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
        })
      )

      return updatedSnippets as Result
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

  async addSnippet(
    context: ActionContext<{
      snippet: Omit<PromptSnippet, 'id'> & {
        id?: string
      }
      saveType: SettingsSaveType
    }>
  ) {
    const { actionParams } = context
    const { saveType, snippet } = actionParams

    try {
      let result

      if (saveType === 'global') {
        result = await promptSnippetsGlobalDB.add({
          ...snippet
        })
      } else {
        result = await promptSnippetsWorkspaceDB.add({
          ...snippet
        })
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
      updates: Partial<Omit<PromptSnippet, 'id'>>
    }>
  ) {
    const { actionParams } = context
    const { id, updates } = actionParams
    try {
      const result =
        (await promptSnippetsGlobalDB.update(id, updates)) ||
        (await promptSnippetsWorkspaceDB.update(id, updates))

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

  async searchSnippets<
    WithSaveType extends boolean,
    Result extends WithSaveType extends true
      ? PromptSnippetWithSaveType[]
      : PromptSnippet[]
  >(
    context: ActionContext<{
      query: string
      withSaveType?: WithSaveType
      isRefresh?: boolean
    }>
  ): Promise<Result> {
    const { actionParams } = context
    const { query, withSaveType, isRefresh } = actionParams
    try {
      const snippets = await this.getSnippets({
        ...context,
        actionParams: { isRefresh, withSaveType }
      })

      const lowerQuery = query.toLowerCase()

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
      logger.error('Failed to search snippets:', error)
      throw error
    }
  }
}
