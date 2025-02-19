import path from 'path'
import { aidePaths, getSemanticHashName } from '@extension/file-utils/paths'
import { vfs } from '@extension/file-utils/vfs'
import { logger } from '@extension/logger'
import { getErrorMsg, settledPromiseResults, sleep } from '@shared/utils/common'
import * as cheerio from 'cheerio'

import { ProgressReporter } from '../progress-reporter'
import { ContentExtractor } from './content-extractor'
import { HttpClient } from './http-client'
import {
  DEFAULT_OPTIONS,
  EXCLUDED_PATHS,
  UNSUPPORTED_FILE_EXTENSIONS,
  type CrawlerOptions,
  type QueueItem
} from './utils'

export class DocCrawler {
  private baseUrl: string

  private options: CrawlerOptions

  private visited: Set<string> = new Set()

  private queue: QueueItem[] = []

  private content: Record<string, string> = {}

  private depthMap: Map<string, number> = new Map()

  private domainDir!: string

  private httpClient: HttpClient

  private contentExtractor: ContentExtractor

  public progressReporter = new ProgressReporter()

  static async getDocCrawlerFolderPath(baseUrl: string): Promise<string> {
    const parsedUrl = new URL(baseUrl)
    const domainFolderName = getSemanticHashName(
      parsedUrl.hostname,
      parsedUrl.hostname
    )
    return path.join(await aidePaths.getDocsCrawlerPath(), domainFolderName)
  }

  constructor(baseUrl: string, options: Partial<CrawlerOptions> = {}) {
    this.baseUrl = baseUrl
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.queue = [{ url: baseUrl, depth: 0 }]
    this.depthMap.set(baseUrl, 0)
    this.httpClient = new HttpClient()
    this.contentExtractor = new ContentExtractor()
  }

  async init(): Promise<void> {
    this.domainDir = await DocCrawler.getDocCrawlerFolderPath(this.baseUrl)
  }

  async crawl(): Promise<void> {
    await this.clearOutputDir()
    this.progressReporter.setTotalItems(this.options.maxPages)

    while (this.queue.length > 0 && this.visited.size < this.options.maxPages) {
      const batch = this.queue.splice(0, this.options.concurrency)
      await this.processBatch(batch)
      await sleep(1000)
      this.progressReporter.setProcessedItems(this.visited.size)
    }

    this.progressReporter.setProcessedItems(this.options.maxPages)
  }

  async getPageContent(
    pageUrl: string,
    retries: number = 3
  ): Promise<string | null> {
    try {
      const html = await this.httpClient.fetch(pageUrl, this.options.timeout)
      const $ = cheerio.load(html)
      return this.contentExtractor.extract($, this.options.selectors)
    } catch (error) {
      if (retries > 0) {
        await sleep(2000)
        return this.getPageContent(pageUrl, retries - 1)
      }
      logger.error(`Failed to get content for ${pageUrl}:`, error)
      return null
    }
  }

  dispose(): void {
    this.progressReporter.dispose()
  }

  // Private methods
  private async processBatch(batch: QueueItem[]): Promise<void> {
    const promises = batch.map(item => this.crawlPage(item.url, item.depth))
    await settledPromiseResults(promises)
  }

  private async crawlPage(
    pageUrl: string,
    depth: number,
    retries: number = 1
  ): Promise<void> {
    if (this.shouldSkipPage(pageUrl, depth)) return

    try {
      await this.processPage(pageUrl, depth)
    } catch (error) {
      await this.handleCrawlError(error, pageUrl, depth, retries)
    }
  }

  private async processPage(pageUrl: string, depth: number): Promise<void> {
    try {
      const html = await this.httpClient.fetch(pageUrl, this.options.timeout)

      // Add size check for HTML content
      if (html.length > 300000) {
        // 1MB limit
        throw new Error('Page content too large')
      }

      const $ = cheerio.load(html)
      const content = await this.contentExtractor.extract(
        $,
        this.options.selectors
      )

      // Skip if extracted content is too small
      if (content.length < 10) {
        throw new Error('Extracted content too small')
      }

      await this.processPageContent(pageUrl, content, $, depth)
    } catch (error) {
      throw new Error(
        `Failed to process page ${pageUrl}: ${getErrorMsg(error)}`
      )
    }
  }

  private shouldSkipPage(pageUrl: string, depth: number): boolean {
    return this.visited.has(pageUrl) || depth > this.options.maxDepth
  }

  private async processPageContent(
    pageUrl: string,
    content: string,
    $: cheerio.CheerioAPI,
    depth: number
  ): Promise<void> {
    this.content[pageUrl] = content
    this.findAndQueueLinks($, pageUrl, depth)
    this.visited.add(pageUrl)
    await this.savePageContent(pageUrl, content)
  }

  private async handleCrawlError(
    error: unknown,
    pageUrl: string,
    depth: number,
    retries: number
  ): Promise<void> {
    this.visited.add(pageUrl)

    // Don't retry for certain types of errors
    if (
      error instanceof Error &&
      (error.message.includes('too large') ||
        error.message.includes('too small'))
    ) {
      logger.error(`Skipping ${pageUrl} due to: ${error.message}`)
      return
    }

    if (retries > 0) {
      await sleep(2000)
      await this.crawlPage(pageUrl, depth, retries - 1)
    } else {
      logger.error(`Max retries exceeded for ${pageUrl}`)
      return
    }

    logger.error(`Error crawling ${pageUrl}:`, error)

    throw error
  }

  private findAndQueueLinks(
    $: cheerio.CheerioAPI,
    pageUrl: string,
    currentDepth: number
  ): void {
    $('a[href]').each((_, elem) => {
      const href = $(elem).attr('href')
      if (href) {
        const fullUrl = new URL(href, pageUrl).toString()
        if (this.shouldCrawl(fullUrl)) {
          this.queue.push({ url: fullUrl, depth: currentDepth + 1 })
          this.depthMap.set(fullUrl, currentDepth + 1)
        }
      }
    })
  }

  private shouldCrawl(urlToCrawl: string): boolean {
    const parsedBase = new URL(this.baseUrl)
    const parsedUrl = new URL(urlToCrawl)

    return (
      parsedUrl.hostname === parsedBase.hostname &&
      !this.visited.has(urlToCrawl) &&
      !urlToCrawl.includes('#') &&
      !this.isUnsupportedFileUrl(urlToCrawl) &&
      !this.isExcludedPath(parsedUrl.pathname) &&
      this.options.linkFilter(urlToCrawl)
    )
  }

  private isUnsupportedFileUrl(urlString: string): boolean {
    return UNSUPPORTED_FILE_EXTENSIONS.some(ext =>
      urlString.toLowerCase().endsWith(ext)
    )
  }

  private isExcludedPath(pathname: string): boolean {
    return EXCLUDED_PATHS.some(path => pathname.startsWith(path))
  }

  private async clearOutputDir(): Promise<void> {
    await vfs.promises.mkdir(this.domainDir, { recursive: true })
  }

  private async savePageContent(url: string, content: string): Promise<void> {
    const urlObj = new URL(url)
    const fileName = getSemanticHashName(urlObj.pathname, url)
    const filePath = path.join(this.domainDir, `${fileName}.md`)
    await vfs.promises.writeFile(filePath, content, 'utf-8')
  }
}
