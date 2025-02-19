import { generateRandomIP } from './ip'
import realUserHeadersJson from './real-user-headers.json' // see: https://github.com/deedy5/duckduckgo_search/blob/main/duckduckgo_search/headers.json.gz
import { generateRandomChromeUserAgent } from './user-agent'

export const getRandomHeaders = () => {
  const randomIP = generateRandomIP()
  const randomUserAgent = generateRandomChromeUserAgent()

  const headers = {
    'User-Agent': randomUserAgent,
    'X-Forwarded-For': randomIP,
    'X-Forwarded-Proto': 'https',
    'X-Real-IP': randomIP,
    'X-Forwarded-IP': randomIP,
    'X-Requested-With': 'XMLHttpRequest',
    DNT: Math.random() < 0.5 ? '1' : '0',
    Connection: 'keep-alive'
  }

  return headers
}

interface BrowserHeader {
  header: Record<string, string>
  probability: number
}

export const getRealUserRandomHeaders = (): Record<string, string> => {
  const realUserHeaders = realUserHeadersJson as unknown as BrowserHeader[]

  // use random header with probability
  const totalWeight = realUserHeaders.reduce(
    (sum, item) => sum + item.probability,
    0
  )
  let random = Math.random() * totalWeight

  for (const item of realUserHeaders) {
    random -= item.probability
    if (random <= 0) {
      return item.header
    }
  }

  // if no header is selected (should not happen), return the first one
  return realUserHeaders[0]!.header
}
