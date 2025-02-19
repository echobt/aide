/* eslint-disable no-constant-condition */
import { logger } from '@extension/logger'
import { sleep } from '@shared/utils/common'

import { BaseSearcher } from '../base-searcher'
import { API_ENDPOINTS, RESULTS_PER_PAGE } from '../constants'
import { ImageResult, ImageSearchOptions } from '../types'

export class ImageSearcher extends BaseSearcher {
  async search(
    keywords: string,
    options: ImageSearchOptions = {}
  ): Promise<ImageResult[]> {
    if (!keywords) {
      throw new Error('keywords is mandatory')
    }

    const {
      region = 'wt-wt',
      safeSearch: safesearch = 'moderate',
      size,
      color,
      type,
      layout,
      license,
      maxResults
    } = options

    const vqd = await this.getVqd(keywords)
    const results: ImageResult[] = []

    try {
      let currentStart = 0
      while (true) {
        const filters: string[] = []
        if (size) filters.push(`size:${size}`)
        if (color) filters.push(`color:${color}`)
        if (type) filters.push(`type:${type}`)
        if (layout) filters.push(`layout:${layout}`)
        if (license) filters.push(`license:${license}`)

        const params = new URLSearchParams({
          l: region,
          o: 'json',
          q: keywords,
          vqd,
          s: currentStart.toString(),
          p: this.getSafeSearchParam(safesearch),
          f: filters.join(',')
        })

        const response = await this.fetchWithTimeout(
          `${API_ENDPOINTS.IMAGES}?${params}`
        )

        const data = await response.json()
        const images = data.results || []

        if (!images.length) {
          break
        }

        for (const img of images) {
          results.push({
            title: img.title,
            image: this.normalizeUrl(img.image),
            thumbnail: this.normalizeUrl(img.thumbnail),
            url: this.normalizeUrl(img.url),
            height: img.height,
            width: img.width,
            source: img.source
          })

          if (maxResults && results.length >= maxResults) {
            return results.slice(0, maxResults)
          }
        }

        if (!data.next || !maxResults) {
          break
        }

        currentStart += RESULTS_PER_PAGE.IMAGES
        await sleep(1000)
      }

      return results
    } catch (error) {
      logger.error('Error during image search:', error)
      throw error
    }
  }
}
