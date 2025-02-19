import { getRealUserRandomHeaders } from '../faker-request-headers'
import type { IHttpClient } from './base-searcher'
import { DEFAULT_OPTIONS } from './constants'

export class HttpClient implements IHttpClient {
  private readonly headers: Record<string, string>

  constructor(
    headers: Record<string, string>,
    private readonly timeout: number
  ) {
    this.headers = {
      ...getRealUserRandomHeaders(), // use random header with probability
      ...headers
    }
  }

  async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        'Accept-Ciphers': this.getRandomCipherSuites().join(':')
      },
      signal: AbortSignal.timeout(this.timeout)
    })

    if (!response.ok) {
      this.handleHttpError(response)
    }

    return response
  }

  private handleHttpError(response: Response): never {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded')
    }
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  protected getRandomCipherSuites(): string[] {
    const modernCiphers = DEFAULT_OPTIONS.slice(0, 6)
    const otherCiphers = DEFAULT_OPTIONS.slice(6)
    const shuffledCiphers = otherCiphers.sort(() => Math.random() - 0.5)
    return [...modernCiphers, ...shuffledCiphers]
  }
}
