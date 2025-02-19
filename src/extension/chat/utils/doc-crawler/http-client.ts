import { logger } from '@extension/logger'
import { isAbortError } from '@shared/utils/common'

import { getRealUserRandomHeaders } from '../faker-request-headers'

export class HttpClient {
  async fetch(url: string, timeout: number): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        headers: {
          ...getRealUserRandomHeaders()
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
