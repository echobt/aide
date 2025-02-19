/* eslint-disable no-constant-condition */
import { logger } from '@extension/logger'
import { sleep } from '@shared/utils/common'

import { BaseSearcher } from '../base-searcher'
import { API_ENDPOINTS, RESULTS_PER_PAGE } from '../constants'
import { NewsResult, type NewsSearchOptions } from '../types'

export class NewsSearcher extends BaseSearcher {
  async search(
    keywords: string,
    options: NewsSearchOptions = {}
  ): Promise<NewsResult[]> {
    if (!keywords) {
      throw new Error('keywords is mandatory')
    }

    const {
      region = 'wt-wt',
      safeSearch: safesearch = 'moderate',
      timeLimit: timelimit,
      maxResults
    } = options

    const vqd = await this.getVqd(keywords)
    const results: NewsResult[] = []
    const cache = new Set<string>()

    try {
      let currentStart = 0
      while (true) {
        const params = new URLSearchParams({
          l: region,
          o: 'json',
          noamp: '1',
          q: keywords,
          vqd,
          s: currentStart.toString(),
          p: this.getSafeSearchParam(safesearch)
        })

        if (timelimit) {
          params.append('df', timelimit)
        }

        const response = await this.fetchWithTimeout(
          `${API_ENDPOINTS.NEWS}?${params}`
        )

        const data = await response.json()
        const newsItems = data.results || []

        if (!newsItems.length) {
          break
        }

        for (const item of newsItems) {
          if (item.url && !cache.has(item.url)) {
            cache.add(item.url)
            results.push({
              date: new Date(item.date * 1000).toISOString(),
              title: this.normalizeText(item.title),
              body: this.normalizeText(item.excerpt),
              url: this.normalizeUrl(item.url),
              image: item.image ? this.normalizeUrl(item.image) : undefined,
              source: item.source
            })

            if (maxResults && results.length >= maxResults) {
              return results.slice(0, maxResults)
            }
          }
        }

        if (!data.next || !maxResults) {
          break
        }

        currentStart += RESULTS_PER_PAGE.NEWS
        await sleep(1000)
      }

      return results
    } catch (error) {
      logger.error('Error during news search:', error)
      throw error
    }
  }
}
