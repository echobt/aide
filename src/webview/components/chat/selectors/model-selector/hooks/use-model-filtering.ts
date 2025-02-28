import { useMemo } from 'react'
import { type AIModel, type AIProvider } from '@shared/entities'
import { removeDuplicates } from '@shared/utils/common'

import { getModelFeatures, ModelFeature } from '../constants'

/**
 * manage model sorting and filtering
 */
export const useModelFiltering = (
  selectedProvider: AIProvider | null,
  providerIdModelsMap: Record<string, AIModel[]>,
  searchQuery: string
) => {
  /**
   * get current provider models, and sort them by manualModels and realTimeModels priority
   */
  const currentProviderModels = useMemo(() => {
    if (!selectedProvider) return []

    const providerModels = providerIdModelsMap[selectedProvider.id] || []

    // if no models, return empty array
    if (providerModels.length === 0) return []

    // get manual models and real-time models
    const manualModelNames = selectedProvider.manualModels || []
    const realTimeModelNames = selectedProvider.realTimeModels || []

    return removeDuplicates([...manualModelNames, ...realTimeModelNames])
  }, [selectedProvider, providerIdModelsMap])

  /**
   * filter models
   */
  const filteredModels = useMemo(() => {
    if (!searchQuery) return currentProviderModels

    return currentProviderModels.filter(model =>
      model.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [currentProviderModels, searchQuery])

  /**
   * categorize models
   */
  const categorizedModels = useMemo(() => {
    const popular: string[] = []
    const regular: string[] = []

    filteredModels.forEach(model => {
      if (getModelFeatures(model).includes(ModelFeature.POPULAR)) {
        popular.push(model)
      } else {
        regular.push(model)
      }
    })

    return { popular, regular }
  }, [filteredModels])

  return {
    currentProviderModels,
    filteredModels,
    categorizedModels
  }
}
