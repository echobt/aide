export interface BrowserHeader {
  header: Record<string, string>
  probability: number
}

export interface Headers {
  headers: BrowserHeader[]
}

export type TimeLimit = 'd' | 'w' | 'm' | 'y'

export interface BaseSearchOptions {
  region?: string
  safeSearch?: SafeSearchLevel
  timeLimit?: TimeLimit
  maxResults?: number
}

export interface TextSearchOptions extends BaseSearchOptions {
  backend?: 'auto' | 'html' | 'lite'
}

export interface NewsSearchOptions extends BaseSearchOptions {}

export interface VideoSearchOptions extends BaseSearchOptions {
  resolution?: 'high' | 'standard'
  duration?: 'short' | 'medium' | 'long'
  license?: 'creativeCommon' | 'youtube'
}

export type SafeSearchLevel = 'on' | 'moderate' | 'off'

export interface SearchResult {
  title: string
  href: string
  body: string
}

export interface ImageSearchOptions extends TextSearchOptions {
  size?: ImageSize
  color?: ImageColor
  type?: ImageType
  layout?: ImageLayout
  license?: ImageLicense
}

export type ImageSize = 'Small' | 'Medium' | 'Large' | 'Wallpaper'
export type ImageColor =
  | 'color'
  | 'Monochrome'
  | 'Red'
  | 'Orange'
  | 'Yellow'
  | 'Green'
  | 'Blue'
  | 'Purple'
  | 'Pink'
  | 'Brown'
  | 'Black'
  | 'Gray'
  | 'Teal'
  | 'White'
export type ImageType = 'photo' | 'clipart' | 'gif' | 'transparent' | 'line'
export type ImageLayout = 'Square' | 'Tall' | 'Wide'
export type ImageLicense =
  | 'any'
  | 'Public'
  | 'Share'
  | 'ShareCommercially'
  | 'Modify'
  | 'ModifyCommercially'

export interface ImageResult {
  title: string
  image: string
  thumbnail: string
  url: string
  height: number
  width: number
  source: string
}

export interface NewsResult {
  date: string
  title: string
  body: string
  url: string
  image?: string
  source: string
}

export interface VideoResult {
  content: string
  description: string
  duration: string
  embed_html: string
  embed_url: string
  images: {
    large: string
    medium: string
    motion: string
    small: string
  }
  provider: string
  published: string
  publisher: string
  title: string
  url: string
}

export interface ISearcher<T, O extends BaseSearchOptions> {
  search(keywords: string, options?: O): Promise<T[]>
}
