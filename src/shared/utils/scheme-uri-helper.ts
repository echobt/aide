import { toUnixPath } from '@shared/utils/common'

/**
 * Helper class for handling scheme URIs
 * Format: scheme://<path>
 */
export class SchemeUriHelper {
  // Cache for parsed URIs
  private static parseCache = new Map<
    string,
    { scheme: string | null; path: string }
  >()

  private static MAX_CACHE_SIZE = 5000

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
    // Check cache first
    const cached = SchemeUriHelper.parseCache.get(uri)
    if (cached) {
      if (throwError && !cached.scheme) {
        throw new Error(`Invalid scheme URI: ${uri}`)
      }
      return cached as any
    }

    const unixUri = toUnixPath(uri)
    const match = unixUri.match(/^([a-zA-Z0-9-]+):\/\/(.*)$/)
    const result: { scheme: string | null; path: string } = {
      scheme: null,
      path: unixUri
    }

    if (!match) {
      if (throwError) throw new Error(`Invalid scheme URI: ${unixUri}`)
      SchemeUriHelper.cacheResult(uri, result)
      return result as any
    }

    result.scheme = match[1] || null
    // Normalize path: remove redundant slashes and dots
    result.path = SchemeUriHelper.normalizePath(match[2] || '')

    if (!result.scheme && throwError) {
      throw new Error(`Invalid scheme URI: ${unixUri}`)
    }

    SchemeUriHelper.cacheResult(uri, result)
    return result as any
  }

  /**
   * Create a new URI with the given scheme and path
   */
  static create(scheme: string, path: string): string {
    if (!scheme) throw new Error('Scheme cannot be empty')
    return `${scheme}://${SchemeUriHelper.normalizePath(path)}`
  }

  /**
   * Join scheme URI parts together
   */
  static join(uri: string, ...paths: string[]): string {
    if (!paths.length) return uri

    const { scheme, path: basePath } = SchemeUriHelper.parse(uri, false)
    const normalizedPaths = paths.map(p => SchemeUriHelper.normalizePath(p))

    // Handle absolute paths in arguments
    if (normalizedPaths.some(p => p.startsWith('/'))) {
      const lastAbsolutePathIndex = normalizedPaths.reduce(
        (lastIndex, path, index) => (path.startsWith('/') ? index : lastIndex),
        -1
      )
      const relevantPaths = normalizedPaths.slice(lastAbsolutePathIndex)
      const joinedPath = SchemeUriHelper.normalizePath(relevantPaths.join('/'))
      return scheme ? SchemeUriHelper.create(scheme, joinedPath) : joinedPath
    }

    const joinedPath = SchemeUriHelper.normalizePath(
      [basePath, normalizedPaths].filter(Boolean).join('/')
    )
    return scheme ? SchemeUriHelper.create(scheme, joinedPath) : joinedPath
  }

  /**
   * Get relative path from one URI to another
   */
  static relative(from: string, to: string): string {
    const fromParsed = SchemeUriHelper.parse(from, false)
    const toParsed = SchemeUriHelper.parse(to, false)

    // If schemes are different, return the full target path
    if (fromParsed.scheme !== toParsed.scheme) {
      return toParsed.path
    }

    const fromParts = fromParsed.path.split('/').filter(Boolean)
    const toParts = toParsed.path.split('/').filter(Boolean)

    // Handle empty paths
    if (!fromParts.length) return toParts.join('/')
    if (!toParts.length) return Array(fromParts.length).fill('..').join('/')

    // Find common prefix
    let i = 0
    const minLength = Math.min(fromParts.length, toParts.length)
    while (i < minLength && fromParts[i] === toParts[i]) {
      i++
    }

    // Special case: if paths are identical
    if (i === fromParts.length && i === toParts.length) {
      return ''
    }

    // Build relative path
    const upCount = fromParts.length - i
    const relativeParts = [...Array(upCount).fill('..'), ...toParts.slice(i)]

    return relativeParts.join('/') || '.'
  }

  /**
   * Get the extension of the path in a scheme URI
   */
  static extname(uri: string): string {
    const { path: uriPath } = SchemeUriHelper.parse(uri, false)
    // Handle special cases
    if (!uriPath || uriPath.endsWith('/')) return ''

    const basename = uriPath.split('/').pop() || ''
    // Handle dotfiles without extension (e.g., .gitignore)
    if (basename.startsWith('.') && !basename.includes('.', 1)) return ''

    const lastDotIndex = basename.lastIndexOf('.')
    return lastDotIndex > 0 ? basename.slice(lastDotIndex) : ''
  }

  /**
   * Only for internal use, can work with scheme URI
   * Normalize a path by removing redundant slashes and resolving dots
   */
  private static normalizePath(path: string): string {
    if (!path) return ''

    // Convert to Unix path and split
    const parts = toUnixPath(path).split('/')
    const result: string[] = []

    for (const part of parts) {
      if (!part || part === '.') continue
      if (part === '..') {
        if (result.length && result[result.length - 1] !== '..') {
          result.pop()
        } else {
          result.push('..')
        }
      } else {
        result.push(part)
      }
    }

    const normalized = result.join('/')
    return path.startsWith('/') ? `/${normalized}` : normalized
  }

  /**
   * Cache parsed URI result and maintain cache size
   */
  private static cacheResult(
    uri: string,
    result: { scheme: string | null; path: string }
  ): void {
    if (SchemeUriHelper.parseCache.size >= SchemeUriHelper.MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = SchemeUriHelper.parseCache.keys().next().value
      if (firstKey) SchemeUriHelper.parseCache.delete(firstKey)
    }
    SchemeUriHelper.parseCache.set(uri, result)
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
