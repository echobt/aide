import { logger } from '@extension/logger'
import { isAbortError } from '@shared/utils/common'

export class HttpClient {
  private generateRandomUserAgent(): string {
    const browsers = ['Chrome', 'Firefox', 'Safari']
    const versions = Array.from({ length: 40 }, (_, i) => i + 30)
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ${browsers[Math.floor(Math.random() * browsers.length)]}/${versions[Math.floor(Math.random() * versions.length)]}.0.0.0 Safari/537.36`
  }

  private generateRandomIP(): string {
    return Array.from({ length: 4 }, () =>
      Math.floor(Math.random() * 256)
    ).join('.')
  }

  async fetch(url: string, timeout: number): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.generateRandomUserAgent(),
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'X-Forwarded-For': this.generateRandomIP(),
          'X-Real-IP': this.generateRandomIP(),
          'X-Originating-IP': this.generateRandomIP(),
          'CF-Connecting-IP': this.generateRandomIP(),
          'True-Client-IP': this.generateRandomIP()
        },
        signal: controller.signal
      })

      if (!response.ok) {
        if (response.status === 404) {
          logger.error(`Page not found: ${url}`)
          return ''
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.text()
    } catch (error) {
      if (isAbortError(error)) {
        logger.error(`Timeout while fetching ${url}`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
