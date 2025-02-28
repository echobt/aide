import { useMemo, useState } from 'react'
import { type AIProvider } from '@shared/entities'

/**
 * manage search functionality
 */
export const useSearch = (providers: AIProvider[]) => {
  const [searchQuery, setSearchQuery] = useState('')

  /**
   * filter providers
   */
  const filteredProviders = useMemo(() => {
    if (!searchQuery) return providers

    return providers.filter(provider =>
      provider.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [providers, searchQuery])

  /**
   * clear search
   */
  const clearSearch = () => {
    setSearchQuery('')
  }

  return {
    searchQuery,
    setSearchQuery,
    filteredProviders,
    clearSearch
  }
}
