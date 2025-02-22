/* eslint-disable react-compiler/react-compiler */
import { useEffect, useMemo, useRef, useState } from 'react'
import { MentionOption, SearchSortStrategy } from '@webview/types/chat'
import MiniSearch from 'minisearch'

const flattenCurrentLevelOptions = (
  options: MentionOption[]
): MentionOption[] =>
  options.reduce((acc: MentionOption[], option) => {
    if (option.children) {
      return [...acc, ...option.children]
    }
    return [...acc, option]
  }, [])

export interface UseFilteredMentionOptions {
  currentOptions: MentionOption[]
  searchQuery: string
  maxItemLength: number
}

export const useFilteredMentionOptions = (props: UseFilteredMentionOptions) => {
  const { currentOptions, searchQuery, maxItemLength } = props
  const [isFlattened, setIsFlattened] = useState(false)
  const currentOptionsSearchServiceRef = useRef<SearchService>(
    new SearchService()
  )
  const flattenedOptionsSearchServiceRef = useRef<SearchService>(
    new SearchService()
  )

  useEffect(() => {
    currentOptionsSearchServiceRef.current.indexOptions(currentOptions)
  }, [currentOptions])

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return currentOptions.slice(0, maxItemLength)

    let matches = currentOptionsSearchServiceRef.current.search(searchQuery)

    if (matches.length > 0) {
      setIsFlattened(false)
      return matches.slice(0, maxItemLength)
    }

    // If no matches, try flattened options
    const flattenedOptions = flattenCurrentLevelOptions(currentOptions)
    flattenedOptionsSearchServiceRef.current.indexOptions(flattenedOptions)
    matches = flattenedOptionsSearchServiceRef.current.search(searchQuery)

    if (matches.length > 0) {
      setIsFlattened(true)
      return matches.slice(0, maxItemLength)
    }

    setIsFlattened(false)
    return []
  }, [searchQuery, currentOptions, maxItemLength])

  return { filteredOptions, isFlattened, setIsFlattened }
}

class SearchService {
  private miniSearch: MiniSearch<MentionOption>

  private optionsMap: Map<string, MentionOption> = new Map()

  constructor() {
    // Initialize MiniSearch with configuration
    this.miniSearch = new MiniSearch({
      fields: ['label', 'searchKeywords'],
      storeFields: ['id', 'label', 'searchSortStrategy'],
      // Support both exact matches and prefix matches
      tokenize: (string, _fieldName) => {
        const tokens = string.toLowerCase().split(/\s+/)
        // Add character combinations for prefix matching
        const prefixes = []
        for (const token of tokens) {
          for (let i = 1; i <= token.length; i++) {
            prefixes.push(token.slice(0, i))
          }
        }
        return [...new Set([...tokens, ...prefixes])]
      },
      extractField: (document, fieldName) => {
        if (fieldName === 'searchKeywords') {
          return document.searchKeywords?.join(' ') || ''
        }
        return document[fieldName as keyof MentionOption]
      }
    })
  }

  indexOptions(options: MentionOption[]) {
    this.optionsMap.clear()
    options.forEach(option => {
      this.optionsMap.set(option.id, option)
    })

    // Add documents to MiniSearch
    this.miniSearch.removeAll()
    this.miniSearch.addAll(options)
  }

  search(query: string): MentionOption[] {
    const searchResults = this.miniSearch.search(query, {
      prefix: true,
      fuzzy: 0.2
    })

    const matchedOptions = searchResults
      .map(result => this.optionsMap.get(result.id))
      .filter(Boolean) as MentionOption[]

    return this.sortOptionsByStrategy(query, matchedOptions)
  }

  private sortOptionsByStrategy(
    query: string,
    options: MentionOption[]
  ): MentionOption[] {
    return options.sort((a, b) => {
      const scoreA = this.getMatchScore(query, a)
      const scoreB = this.getMatchScore(query, b)
      return scoreB - scoreA
    })
  }

  private getMatchScore(query: string, option: MentionOption): number {
    const label = option.label.toLowerCase()
    const q = query.toLowerCase()

    // Exact match gets highest score
    if (label === q) return 1000

    // Prefix match is second best
    if (label.startsWith(q)) return 500 + q.length / label.length

    // EndMatch strategy
    if (option.searchSortStrategy === SearchSortStrategy.EndMatch) {
      let matchLength = 0
      for (let i = 1; i <= Math.min(label.length, q.length); i++) {
        if (label.slice(-i) === q.slice(-i)) {
          matchLength = i
        } else {
          break
        }
      }

      if (matchLength === q.length) {
        return 200 + matchLength
      }

      return matchLength
    }

    // Contains match
    if (label.includes(q)) return 50

    return 0
  }
}
