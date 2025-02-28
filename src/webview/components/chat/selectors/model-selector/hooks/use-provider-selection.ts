import { useEffect, useState } from 'react'
import { FeatureModelSettingKey, type AIProvider } from '@shared/entities'

/**
 * manage provider filtering and selection
 */
export const useProviderSelection = (
  providers: AIProvider[],
  selectedProviderId?: string,
  featureModelSettingKey?: FeatureModelSettingKey
) => {
  // selected provider
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(
    providers.find(p => p.id === selectedProviderId) || null
  )

  // show default option
  const [showDefaultOption, setShowDefaultOption] = useState(
    !selectedProviderId &&
      featureModelSettingKey !== FeatureModelSettingKey.Default
  )

  // when selected provider changes, update the selected provider
  useEffect(() => {
    if (selectedProviderId) {
      const provider = providers.find(p => p.id === selectedProviderId)
      if (provider) {
        setSelectedProvider(provider)
        setShowDefaultOption(false)
      }
    } else if (featureModelSettingKey !== FeatureModelSettingKey.Default) {
      setSelectedProvider(null)
      setShowDefaultOption(true)
    } else if (providers.length > 0) {
      setSelectedProvider(providers[0] || null)
      setShowDefaultOption(false)
    }
  }, [selectedProviderId, providers, featureModelSettingKey])

  /**
   * handle provider selection
   */
  const handleProviderSelect = (provider: AIProvider) => {
    setSelectedProvider(provider)
    setShowDefaultOption(false)
  }

  /**
   * handle default option selection
   */
  const handleDefaultSelect = () => {
    setSelectedProvider(null)
    setShowDefaultOption(true)
  }

  return {
    selectedProvider,
    showDefaultOption,
    handleProviderSelect,
    handleDefaultSelect
  }
}
