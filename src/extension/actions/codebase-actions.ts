import type { ReIndexType } from '@extension/chat/vectordb/base-indexer'
import { CodebaseWatcherRegister } from '@extension/registers/codebase-watcher-register'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { ProgressInfo } from '@webview/types/chat'

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

    const indexingPromise = indexer.reindexWorkspace(type)

    for await (const progress of indexer.progressReporter.getProgressIterator()) {
      yield progress
    }

    await indexingPromise
  }
}
