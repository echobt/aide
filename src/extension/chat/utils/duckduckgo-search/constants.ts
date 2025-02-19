export const DEFAULT_TIMEOUT = 10000

export const SAFE_SEARCH_MAP = {
  on: '1',
  moderate: '-1',
  off: '-2'
} as const

// 使用常量类型
export type SafeSearchLevel = keyof typeof SAFE_SEARCH_MAP

export const API_ENDPOINTS = {
  BASE: 'https://duckduckgo.com',
  HTML: 'https://html.duckduckgo.com/html',
  IMAGES: 'https://duckduckgo.com/i.js',
  NEWS: 'https://duckduckgo.com/news.js',
  VIDEOS: 'https://duckduckgo.com/v.js'
} as const

export const RESULTS_PER_PAGE = {
  TEXT: 30,
  IMAGES: 100,
  NEWS: 30,
  VIDEOS: 30
} as const

export const TIME_LIMITS = {
  DAY: 'd',
  WEEK: 'w',
  MONTH: 'm',
  YEAR: 'y'
} as const

export const DEFAULT_OPTIONS = [
  // Modern:
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  // Compatible:
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-AES128-SHA256',
  'ECDHE-RSA-AES128-SHA256',
  'ECDHE-ECDSA-AES256-SHA384',
  'ECDHE-RSA-AES256-SHA384',
  // Legacy:
  'ECDHE-ECDSA-AES128-SHA',
  'ECDHE-RSA-AES128-SHA',
  'AES128-GCM-SHA256',
  'AES128-SHA256',
  'AES128-SHA',
  'ECDHE-RSA-AES256-SHA',
  'AES256-GCM-SHA384',
  'AES256-SHA256',
  'AES256-SHA',
  'DES-CBC3-SHA'
]
