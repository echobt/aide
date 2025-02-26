import { type ProgressInfo } from '@extension/chat/utils/progress-reporter'
import type { ReIndexType } from '@extension/chat/vectordb/base-pgvector-indexer'
import { internalConfigDB } from '@extension/lowdb/internal-config-db'
import { CodebaseWatcherRegister } from '@extension/registers/codebase-watcher-register'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { isAbortError } from '@shared/utils/common'
import { t } from 'i18next'

export class CodebaseActionsCollection extends ServerActionCollection {
  readonly categoryName = 'codebase'

  async *reindexCodebase(
    context: ActionContext<{ type: ReIndexType }>
  ): AsyncGenerator<ProgressInfo, void, unknown> {
    const { actionParams, abortController } = context
    const { type } = actionParams
    const codebaseWatcherRegister = this.registerManager.getRegister(
      CodebaseWatcherRegister
    )

    if (!codebaseWatcherRegister)
      throw new Error(t('extension.codebaseActions.codebaseWatcherNotFound'))

    const { indexer } = codebaseWatcherRegister
    if (!indexer)
      throw new Error(t('extension.codebaseActions.indexerNotFound'))

    // Reset status when starting
    await internalConfigDB.updateConfig({
      lastCodebaseIndexTime: undefined,
      lastCodebaseIndexCompleted: false
    })

    try {
      const indexingCompleted = indexer.reindexWorkspace(type, abortController)

      for await (const progress of indexer.progressReporter.getProgressIterator()) {
        yield progress
      }

      await indexingCompleted

      // Update internal config to indicate indexing has completed
      await internalConfigDB.updateConfig({
        lastCodebaseIndexTime: Date.now(),
        lastCodebaseIndexCompleted: true
      })
    } catch (error) {
      // If aborted, don't update status
      if (!isAbortError(error)) {
        await internalConfigDB.updateConfig({
          lastCodebaseIndexCompleted: false,
          lastCodebaseIndexTime: undefined
        })
      } else {
        throw error
      }
    }
  }

  async getIndexingStatus(context: ActionContext<{}>): Promise<{
    lastIndexTime?: number
    isIndexCompleted: boolean
  }> {
    const config = await internalConfigDB.getConfig()
    return {
      lastIndexTime: config.lastCodebaseIndexTime,
      isIndexCompleted: config.lastCodebaseIndexCompleted
    }
  }
}
