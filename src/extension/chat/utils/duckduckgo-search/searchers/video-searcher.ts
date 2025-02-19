/* eslint-disable no-constant-condition */
import { logger } from '@extension/logger'
import { sleep } from '@shared/utils/common'

import { BaseSearcher } from '../base-searcher'
import { API_ENDPOINTS, RESULTS_PER_PAGE } from '../constants'
import { VideoResult, type VideoSearchOptions } from '../types'

export class VideoSearcher extends BaseSearcher {
  async search(
    keywords: string,
    options: VideoSearchOptions = {}
  ): Promise<VideoResult[]> {
    if (!keywords) {
      throw new Error('keywords is mandatory')
    }

    const {
      region = 'wt-wt',
      safeSearch: safesearch = 'moderate',
      timeLimit: timelimit,
      resolution,
      duration,
      license,
      maxResults
    } = options

    const vqd = await this.getVqd(keywords)
    const results: VideoResult[] = []

    try {
      let currentStart = 0
      while (true) {
        const filters: string[] = []
        if (timelimit) filters.push(`publishedAfter:${timelimit}`)
        if (resolution) filters.push(`videoDefinition:${resolution}`)
        if (duration) filters.push(`videoDuration:${duration}`)
        if (license) filters.push(`videoLicense:${license}`)

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
          `${API_ENDPOINTS.VIDEOS}?${params}`
        )

        const data = await response.json()
        const videos = data.results || []

        if (!videos.length) {
          break
        }

        for (const video of videos) {
          results.push({
            content: video.content,
            description: this.normalizeText(video.description),
            duration: video.duration,
            embed_html: video.embed_html,
            embed_url: this.normalizeUrl(video.embed_url),
            images: {
              large: this.normalizeUrl(video.images.large),
              medium: this.normalizeUrl(video.images.medium),
              motion: this.normalizeUrl(video.images.motion),
              small: this.normalizeUrl(video.images.small)
            },
            provider: video.provider,
            published: video.published,
            publisher: video.publisher,
            title: this.normalizeText(video.title),
            url: this.normalizeUrl(video.url)
          })

          if (maxResults && results.length >= maxResults) {
            return results.slice(0, maxResults)
          }
        }

        if (!data.next || !maxResults) {
          break
        }

        currentStart += RESULTS_PER_PAGE.VIDEOS
        await sleep(1000)
      }

      return results
    } catch (error) {
      logger.error('Error during video search:', error)
      throw error
    }
  }
}
