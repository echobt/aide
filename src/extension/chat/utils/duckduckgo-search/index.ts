// see: https://github.com/deedy5/duckduckgo_search
import { DEFAULT_TIMEOUT } from './constants'
import { ImageSearcher } from './searchers/image-searcher'
import { NewsSearcher } from './searchers/news-searcher'
import { TextSearcher } from './searchers/text-searcher'
import { VideoSearcher } from './searchers/video-searcher'
import {
  ImageResult,
  type ImageSearchOptions,
  type NewsResult,
  type NewsSearchOptions,
  type SearchResult,
  type TextSearchOptions,
  type VideoResult,
  type VideoSearchOptions
} from './types'

export interface DuckDuckGoSearchConfig {
  headers?: Record<string, string>
  timeout?: number
  verify?: boolean
  retryOptions?: {
    maxRetries: number
    baseDelay: number
  }
}

export class DuckDuckGoSearch {
  private textSearcher: TextSearcher

  private imageSearcher: ImageSearcher

  private newsSearcher: NewsSearcher

  private videoSearcher: VideoSearcher

  constructor(private readonly config: DuckDuckGoSearchConfig = {}) {
    const searcherConfig = {
      headers: config.headers,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      verify: config.verify ?? true
    }

    this.textSearcher = new TextSearcher(searcherConfig)
    this.imageSearcher = new ImageSearcher(searcherConfig)
    this.newsSearcher = new NewsSearcher(searcherConfig)
    this.videoSearcher = new VideoSearcher(searcherConfig)
  }

  async text(
    keywords: string,
    options: TextSearchOptions = {}
  ): Promise<SearchResult[]> {
    return this.textSearcher.search(keywords, options)
  }

  async images(
    keywords: string,
    options: ImageSearchOptions = {}
  ): Promise<ImageResult[]> {
    return this.imageSearcher.search(keywords, options)
  }

  async news(
    keywords: string,
    options: NewsSearchOptions = {}
  ): Promise<NewsResult[]> {
    return this.newsSearcher.search(keywords, options)
  }

  async videos(
    keywords: string,
    options: VideoSearchOptions = {}
  ): Promise<VideoResult[]> {
    return this.videoSearcher.search(keywords, options)
  }
}
