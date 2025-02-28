import { type AIModel, type AIProvider } from '@shared/entities'
import { useLocalStorage } from 'react-use'

// recent model record
export interface RecentModelRecord {
  id: string
  name: string
  providerId: string
  providerName: string
  timestamp: number
}

const RECENT_MODELS_KEY = 'aide-recent-models'
const MAX_RECENT_MODELS = 5

/**
 * manage recent used models
 */
export const useRecentModels = () => {
  const [recentModels, setRecentModels] = useLocalStorage<RecentModelRecord[]>(
    RECENT_MODELS_KEY,
    []
  )

  /**
   * add recent used model
   */
  const addRecentModel = (model: AIModel, provider: AIProvider) => {
    if (!model || !provider) return

    setRecentModels(prev => {
      // create new record
      const newRecord: RecentModelRecord = {
        id: model.id,
        name: model.name,
        providerId: provider.id,
        providerName: provider.name,
        timestamp: Date.now()
      }

      // filter out same model (if exists)
      const filtered = prev?.filter(m => m.id !== model.id) || []

      // add new record to the beginning and limit the number
      return [newRecord, ...filtered].slice(0, MAX_RECENT_MODELS)
    })
  }

  /**
   * clear recent used models
   */
  const clearRecentModels = () => {
    setRecentModels([])
  }

  /**
   * find recent used models from model list
   */
  const findRecentModelsFromList = (
    models: AIModel[],
    providers: AIProvider[]
  ): AIModel[] => {
    if (!recentModels?.length || !models.length || !providers.length) return []

    const providerMap = new Map<string, AIProvider>()
    providers.forEach(provider => {
      providerMap.set(provider.id, provider)
    })

    const modelMap = new Map<string, AIModel>()
    models.forEach(model => {
      modelMap.set(model.id, model)
    })

    // find recent used models in the model list
    const foundModels: AIModel[] = []
    recentModels.forEach(recentModel => {
      const model = modelMap.get(recentModel.id)
      if (model && providerMap.has(recentModel.providerId)) {
        foundModels.push(model)
      }
    })

    return foundModels
  }

  return {
    recentModels: recentModels || [],
    addRecentModel,
    clearRecentModels,
    findRecentModelsFromList
  }
}
