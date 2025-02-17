import { type ProgressInfo } from '@extension/chat/utils/progress-reporter'
import type { ReIndexType } from '@extension/chat/vectordb/base-pgvector-indexer'
import { internalConfigDB } from '@extension/lowdb/internal-config-db'
import { CodebaseWatcherRegister } from '@extension/registers/codebase-watcher-register'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'

export class CodebaseActionsCollection extends ServerActionCollection {
  readonly categoryName = 'codebase'

  async *reindexCodebase(
    context: ActionContext<{ type: ReIndexType }>
  ): AsyncGenerator<ProgressInfo, void, unknown> {
    const { actionParams } = context
    const { type } = actionParams
    const codebaseWatcherRegister = this.registerManager.getRegister(
      CodebaseWatcherRegister
    )

    if (!codebaseWatcherRegister) throw new Error('Codebase watcher not found')

    const { indexer } = codebaseWatcherRegister
    if (!indexer) throw new Error('Indexer not found')

    // Update internal config to indicate indexing has started
    await internalConfigDB.updateConfig({
      lastCodebaseIndexTime: Date.now(),
      lastCodebaseIndexCompleted: false
    })

    try {
      const indexingPromise = indexer.reindexWorkspace(type)

      for await (const progress of indexer.progressReporter.getProgressIterator()) {
        yield progress
      }

      await indexingPromise

      // Update internal config to indicate indexing has completed
      await internalConfigDB.updateConfig({
        lastCodebaseIndexCompleted: true
      })
    } catch (error) {
      // Update internal config to indicate indexing failed
      await internalConfigDB.updateConfig({
        lastCodebaseIndexCompleted: false
      })
      throw error
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
