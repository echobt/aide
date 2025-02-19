/* eslint-disable no-constant-condition */
import { logger } from '@extension/logger'
import { sleep } from '@shared/utils/common'

import { BaseSearcher } from '../base-searcher'
import { API_ENDPOINTS, RESULTS_PER_PAGE } from '../constants'
import { SearchResult, TextSearchOptions } from '../types'

export class TextSearcher extends BaseSearcher {
  async search(
    keywords: string,
    options: TextSearchOptions = {}
  ): Promise<SearchResult[]> {
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
    const results: SearchResult[] = []

    try {
      let currentStart = 0
      while (true) {
        const params = new URLSearchParams({
          q: keywords,
          kl: region,
          p: this.getSafeSearchParam(safesearch),
          s: currentStart.toString(),
          vqd
        })

        if (timelimit) {
          params.append('df', timelimit)
        }

        const response = await this.fetchWithTimeout(
          `${API_ENDPOINTS.HTML}/?${params}`,
          { method: 'GET' }
        )

        const html = await response.text()

        if (html.includes('No results.')) {
          break
        }

        const newResults = this.parseResults(html)
        if (!newResults.length || !maxResults) {
          break
        }

        results.push(...newResults)

        if (maxResults && results.length >= maxResults) {
          return results.slice(0, maxResults)
        }

        currentStart += RESULTS_PER_PAGE.TEXT
        await sleep(1000)
      }

      return results
    } catch (error) {
      logger.error('Error during text search:', error)
      throw error
    }
  }

  private parseResults(html: string): SearchResult[] {
    const results: SearchResult[] = []
    const matches = html.matchAll(
      /<h2 class="result__title">.*?<a.*?href="(?<href>.*?)".*?>(?<title>.*?)<\/a>.*?<a.*?class="result__snippet".*?>(?<body>.*?)<\/a>/gs
    )

    for (const match of matches) {
      const { href, title, body } = match.groups || {}

      if (!href || !title || !body) {
        continue
      }

      // Skip ads and google search results
      if (
        href.startsWith('http://www.google.com/search?q=') ||
        href.startsWith('https://duckduckgo.com/y.js?ad_domain')
      ) {
        continue
      }

      // Extract real URL from DuckDuckGo redirect URL
      let realUrl = href
      if (href.includes('duckduckgo.com/l/?') && href.includes('uddg=')) {
        try {
          const match = href.match(/[?&]uddg=([^&]+)/)
          if (match?.[1]) {
            realUrl = decodeURIComponent(match[1])
          }
        } catch (error) {
          logger.warn(
            'Failed to extract real URL from DuckDuckGo redirect:',
            error
          )
        }
      }

      results.push({
        title: this.normalizeText(title),
        href: this.normalizeUrl(realUrl),
        body: this.normalizeText(body)
      })
    }

    return results
  }
}
