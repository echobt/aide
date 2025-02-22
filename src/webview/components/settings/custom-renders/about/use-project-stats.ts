import { useQuery } from '@tanstack/react-query'
import { logger } from '@webview/utils/logger'

export interface Contributor {
  login: string
  avatar_url: string
  contributions: number
  html_url: string
}

export interface RepoStats {
  stars: number
  forks: number
  subscribers: number
}

const GITHUB_API_MIRRORS = [
  'https://api.github.com',
  'https://gh-api.deno.dev', // Deno Deploy mirror
  'https://gh.gcdn.mirr.one' // Another popular mirror
]

const fetchWithTimeout = async (url: string, timeout = 5000) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    return data
  } finally {
    clearTimeout(timeoutId)
  }
}

const fetchWithFallback = async (path: string, timeout = 5000) => {
  let lastError: Error | null = null

  for (const baseUrl of GITHUB_API_MIRRORS) {
    try {
      const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
      const data = await fetchWithTimeout(url, timeout)
      return data
    } catch (error) {
      lastError = error as Error
      continue
    }
  }

  if (lastError) {
    throw lastError
  } else {
    throw new Error('Failed to fetch data')
  }
}

const useRepoStats = () =>
  useQuery({
    queryKey: ['repo-stats'],
    queryFn: async () => {
      try {
        const data = await fetchWithFallback('repos/nicepkg/aide')
        return {
          stars:
            typeof data.stargazers_count === 'number'
              ? data.stargazers_count
              : 0,
          forks: typeof data.forks_count === 'number' ? data.forks_count : 0,
          subscribers:
            typeof data.subscribers_count === 'number'
              ? data.subscribers_count
              : 0
        } as RepoStats
      } catch (error) {
        logger.log('Failed to fetch repo stats:', error)
        return { stars: 0, forks: 0, subscribers: 0 }
      }
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000)
  })

const useContributors = () =>
  useQuery({
    queryKey: ['contributors'],
    queryFn: async () => {
      try {
        const data = await fetchWithFallback('repos/nicepkg/aide/contributors')

        if (!Array.isArray(data)) return []

        const contributors = data
          .filter(
            (contributor: any): contributor is Contributor =>
              contributor &&
              typeof contributor.login === 'string' &&
              typeof contributor.avatar_url === 'string' &&
              typeof contributor.contributions === 'number' &&
              typeof contributor.html_url === 'string' &&
              // Filter out bots
              !contributor.login.includes('[bot]') && // Filter GitHub bot accounts
              !contributor.login.endsWith('-bot') && // Filter accounts ending with -bot
              !contributor.login.includes('dependabot') && // Filter dependabot
              !contributor.login.includes('renovate') && // Filter renovatebot
              contributor.type !== 'Bot' // Filter accounts marked as Bot type
          )
          .sort((a, b) => {
            if (a.login === '2214962083') return -1
            if (b.login === '2214962083') return 1
            return b.contributions - a.contributions
          })

        if (
          contributors.length > 0 &&
          contributors[0]!.login === '2214962083'
        ) {
          contributors[0]!.login = 'Jinming Yang'
        }

        return contributors
      } catch (error) {
        logger.log('Failed to fetch contributors:', error)
        return []
      }
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000)
  })

const useInstalls = () =>
  useQuery({
    queryKey: ['installs'],
    queryFn: async () => {
      try {
        // Try the primary API first
        const response = await fetch(
          'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json;api-version=7.1-preview.1',
              'X-Market-Client-Id': 'VSCode'
            },
            body: JSON.stringify({
              filters: [
                {
                  criteria: [{ filterType: 7, value: 'nicepkg.aide-pro' }]
                }
              ],
              flags: 914
            })
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        const statistics = data.results?.[0]?.extensions?.[0]?.statistics

        if (Array.isArray(statistics)) {
          const installCount = statistics.find(
            (stat: any) => stat.statisticName === 'install'
          )
          if (installCount?.value) {
            return installCount.value
          }
        }

        throw new Error('Invalid response format')
      } catch (error) {
        logger.log('Failed to fetch install count:', error)

        // Fallback to the original stats API
        try {
          const fallbackResponse = await fetch(
            'https://marketplace.visualstudio.com/_apis/public/gallery/publishers/nicepkg/extensions/aide-pro/stats',
            {
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json;api-version=7.1-preview.1',
                'X-Market-Client-Id': 'VSCode'
              }
            }
          )

          if (!fallbackResponse.ok) {
            throw new Error(`HTTP error! status: ${fallbackResponse.status}`)
          }

          const fallbackData = await fallbackResponse.json()
          const installStats = fallbackData.statistics?.find(
            (stat: any) => stat.statisticName === 'install'
          )

          return installStats?.value || 0
        } catch (fallbackError) {
          logger.log('Failed to fetch from fallback API:', fallbackError)
          return 0
        }
      }
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000)
  })

export const useProjectStats = () => {
  const repoStats = useRepoStats()
  const contributors = useContributors()
  const installs = useInstalls()

  return {
    data: {
      ...repoStats.data,
      contributors: contributors.data || [],
      installs: installs.data || 0
    },
    isLoading:
      repoStats.isLoading || contributors.isLoading || installs.isLoading,
    isError: repoStats.isError || contributors.isError || installs.isError
  }
}
