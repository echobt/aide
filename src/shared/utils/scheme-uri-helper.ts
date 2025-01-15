import { toUnixPath } from '@shared/utils/common'

/**
 * Helper class for handling scheme URIs
 * Format: scheme://<path>
 */
export class SchemeUriHelper {
  private scheme: string

  private path: string

  /**
   * Parse a scheme URI into scheme and path
   */
  static parse<T extends boolean>(
    uri: string,
    throwError: T
  ): T extends true
    ? { scheme: string; path: string }
    : { scheme: string | null; path: string } {
    const match = uri.match(/^([a-zA-Z0-9-]+):\/\/(.*)$/)
    const result: { scheme: string | null; path: string } = {
      scheme: null,
      path: uri
    }

    if (!match) {
      if (throwError) throw new Error(`Invalid scheme URI: ${uri}`)
      return result as any
    }

    result.scheme = match[1] || null
    result.path = match[2] || ''

    if (!result.scheme && throwError) {
      throw new Error(`Invalid scheme URI: ${uri}`)
    }

    return result as any
  }

  /**
   * Create a new URI with the given scheme and path
   */
  static create(scheme: string, path: string): string {
    return `${scheme}://${toUnixPath(path)}`
  }

  constructor(uri: string) {
    const { scheme, path } = SchemeUriHelper.parse(uri, true)

    this.scheme = scheme
    this.path = path
  }

  /**
   * Get the scheme part of the URI
   */
  getScheme(): string {
    return this.scheme
  }

  /**
   * Get the path part of the URI
   */
  getPath(): string {
    return this.path
  }

  /**
   * Get path segments split by '/'
   */
  getPathSegments(): string[] {
    return this.path.split('/').filter(Boolean)
  }
}
