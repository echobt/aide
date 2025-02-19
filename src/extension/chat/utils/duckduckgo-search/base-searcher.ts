import { logger } from '@extension/logger'

import {
  API_ENDPOINTS,
  DEFAULT_OPTIONS,
  DEFAULT_TIMEOUT,
  SAFE_SEARCH_MAP
} from './constants'
import { HttpClient } from './http-client'
import type { BaseSearchOptions } from './types'

export interface IHttpClient {
  fetchWithTimeout(url: string, options?: RequestInit): Promise<Response>
}

export abstract class BaseSearcher {
  protected readonly httpClient: IHttpClient

  constructor(
    protected readonly options: {
      headers?: Record<string, string>
      timeout?: number
      verify?: boolean
    }
  ) {
    const timeout = options.timeout || DEFAULT_TIMEOUT
    this.httpClient = new HttpClient(options.headers || {}, timeout)
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    return this.httpClient.fetchWithTimeout(url, options)
  }

  protected async getVqd(keywords: string): Promise<string> {
    try {
      const response = await this.httpClient.fetchWithTimeout(
        `${API_ENDPOINTS.BASE}/?q=${encodeURIComponent(keywords)}`
      )

      const html = await response.text()
      const vqdMatch = html.match(/vqd="([^"]+)"/) || html.match(/vqd=([^&]+)&/)

      if (!vqdMatch?.[1]) {
        throw new Error('Could not extract vqd')
      }

      return vqdMatch[1]
    } catch (error) {
      logger.error('Error getting vqd:', error)
      throw error
    }
  }

  protected normalizeUrl(url: string): string {
    // Decode the URL first
    let normalizedUrl = decodeURIComponent(url).replace(/ /g, '+')

    // Handle protocol-relative URLs (starting with //)
    if (normalizedUrl.startsWith('//')) {
      normalizedUrl = `https:${normalizedUrl}`
    }

    // Handle URLs without protocol
    if (
      !normalizedUrl.startsWith('http://') &&
      !normalizedUrl.startsWith('https://')
    ) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    return normalizedUrl
  }

  protected normalizeText(text: string): string {
    return text.replace(/<[^>]*>/g, '').trim()
  }

  protected getSafeSearchParam(
    safesearch: BaseSearchOptions['safeSearch']
  ): string {
    return SAFE_SEARCH_MAP[safesearch || 'moderate']
  }

  protected getRandomCipherSuites(): string[] {
    const modernCiphers = DEFAULT_OPTIONS.slice(0, 6)
    const otherCiphers = DEFAULT_OPTIONS.slice(6)
    const shuffledCiphers = otherCiphers.sort(() => Math.random() - 0.5)
    return [...modernCiphers, ...shuffledCiphers]
  }
}
