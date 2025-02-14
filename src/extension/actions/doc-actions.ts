import {
  DocCrawler,
  type CrawlerOptions
} from '@extension/chat/utils/doc-crawler'
import type { ReIndexType } from '@extension/chat/vectordb/base-indexer'
import { DocIndexer } from '@extension/chat/vectordb/doc-indexer'
import { aidePaths } from '@extension/file-utils/paths'
import { docSchemeHandler } from '@extension/file-utils/vfs/schemes/doc-scheme'
import { logger } from '@extension/logger'
import { docSitesDB } from '@extension/lowdb/doc-sites-db'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type { DocSite } from '@shared/entities'
import type { ProgressInfo } from '@webview/types/chat'
import { z } from 'zod'

// Add schema validation
const docSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  url: z.string().url('Invalid URL'),
  isCrawled: z.boolean().optional(),
  isIndexed: z.boolean().optional()
}) satisfies z.ZodType<Partial<DocSite>>

export class DocActionsCollection extends ServerActionCollection {
  readonly categoryName = 'doc'

  private docCrawlers: Record<string, DocCrawler> = {}

  private docIndexers: Record<string, DocIndexer> = {}

  // Add validation method
  private async validateDocSite(data: Partial<DocSite>): Promise<void> {
    await docSiteSchema.parseAsync(data)
  }

  async getDocSites(context: ActionContext<{}>) {
    return await docSitesDB.getAll()
  }

  async addDocSite(context: ActionContext<{ name: string; url: string }>) {
    const { actionParams } = context
    const { name, url } = actionParams
    // Validate doc site data
    await this.validateDocSite(actionParams)
    return await docSitesDB.add({ name, url })
  }

  async removeDocSite(context: ActionContext<{ id: string }>) {
    const { actionParams } = context
    const { id } = actionParams
    await docSitesDB.remove(id)
    this.disposeResources(id)
  }

  async removeDocSites(context: ActionContext<{ ids: string[] }>) {
    const { actionParams } = context
    const { ids } = actionParams
    await docSitesDB.batchRemove(ids)
    ids.forEach(id => this.disposeResources(id))
  }

  async *crawlDocs(
    context: ActionContext<{
      id: string
      options?: Partial<CrawlerOptions>
    }>
  ): AsyncGenerator<ProgressInfo, void, unknown> {
    const { actionParams } = context
    const { id, options } = actionParams
    try {
      const site = await this.findSiteById(id)
      if (!site) throw new Error('can not find doc site')

      const crawler = await this.initiateCrawler(id, site.url, options)
      const crawlingCompleted = crawler.crawl()

      yield* this.reportProgress(crawler.progressReporter.getProgressIterator())
      await crawlingCompleted

      await docSitesDB.updateStatus(id, { isCrawled: true })
      logger.log('docs crawled')
    } finally {
      this.disposeCrawler(id)
    }
  }

  async *reindexDocs(
    context: ActionContext<{ id: string; type: ReIndexType }>
  ): AsyncGenerator<ProgressInfo, void, unknown> {
    const { actionParams } = context
    const { id, type } = actionParams
    try {
      const site = await this.findSiteById(id)
      if (!site) throw new Error('can not find doc site')
      if (!site.isCrawled) throw new Error('please crawl the site first')

      const indexer = await this.initiateIndexer(id)
      const indexingCompleted = indexer.reindexWorkspace(type)
      yield* this.reportProgress(indexer.progressReporter.getProgressIterator())
      await indexingCompleted

      await docSitesDB.updateStatus(id, { isIndexed: true })
      logger.log('docs indexed')
    } finally {
      this.disposeIndexer(id)
    }
  }

  async updateDocSite(
    context: ActionContext<{ id: string; name: string; url: string }>
  ) {
    const { actionParams } = context
    const { id, ...updates } = actionParams
    // Validate doc site updates
    await this.validateDocSite(updates)
    return await docSitesDB.update(id, updates)
  }

  async searchDocSites(context: ActionContext<{ query: string }>) {
    const { actionParams } = context
    const { query } = actionParams
    const sites = await docSitesDB.getAll()
    return sites.filter(
      site =>
        site.name.toLowerCase().includes(query.toLowerCase()) ||
        site.url.toLowerCase().includes(query.toLowerCase())
    )
  }

  private async findSiteById(id: string) {
    const sites = await docSitesDB.getAll()
    return sites.find(site => site.id === id)
  }

  private async initiateCrawler(
    id: string,
    url: string,
    options?: Partial<CrawlerOptions>
  ) {
    if (this.docCrawlers[id]) return this.docCrawlers[id]!
    const crawler = new DocCrawler(url, options)
    await crawler.init()
    this.docCrawlers[id] = crawler
    return crawler
  }

  private async initiateIndexer(id: string) {
    if (this.docIndexers[id]) return this.docIndexers[id]!
    const site = await this.findSiteById(id)
    const docsRootSchemeUri = docSchemeHandler.createSchemeUri({
      siteName: site!.name,
      relativePath: './'
    })
    const dbPath = await aidePaths.getGlobalLanceDbPath()
    const indexer = new DocIndexer(docsRootSchemeUri, dbPath)
    await indexer.initialize()
    this.docIndexers[id] = indexer
    return indexer
  }

  private disposeResources(id: string) {
    this.disposeCrawler(id)
    this.disposeIndexer(id)
  }

  private disposeCrawler(id: string) {
    this.docCrawlers[id]?.dispose()
    delete this.docCrawlers[id]
  }

  private disposeIndexer(id: string) {
    this.docIndexers[id]?.dispose()
    delete this.docIndexers[id]
  }

  private async *reportProgress(progressIterator: AsyncIterable<ProgressInfo>) {
    for await (const progress of progressIterator) {
      yield progress
    }
  }
}
