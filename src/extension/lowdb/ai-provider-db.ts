import path from 'path'
import { aidePaths } from '@extension/file-utils/paths'
import {
  AIModelEntity,
  AIProviderType,
  UnknownAIProviderEntity,
  type AIModel,
  type AIProvider
} from '@shared/entities'
import { removeDuplicates } from '@shared/utils/common'
import { t } from 'i18next'

import { BaseDB } from './_base'
import { aiModelDB } from './ai-model-db'

const findNewModel = async (
  modelsName: string[],
  providerOrBaseUrl: string
): Promise<Omit<AIModel, 'id'>[]> => {
  const allModels = await aiModelDB.getAll()

  // Create a Set for O(1) lookup
  const existingModelSet = new Set(
    allModels
      .filter(model => model.providerOrBaseUrl === providerOrBaseUrl)
      .map(model => model.name)
  )

  // Filter out models that don't exist yet
  return modelsName
    .filter(name => !existingModelSet.has(name))
    .map(
      name =>
        new AIModelEntity(t, {
          name,
          providerOrBaseUrl
        }).entity
    )
}

class AIProviderDB extends BaseDB<AIProvider> {
  static readonly schemaVersion = 1

  async init() {
    await this.initConfig({
      filePath: path.join(
        await aidePaths.getGlobalLowdbPath(),
        'ai-providers.json'
      ),
      currentVersion: AIProviderDB.schemaVersion
    })
  }

  getDefaults(): Partial<AIProvider> {
    return new UnknownAIProviderEntity(t).entity
  }

  async add(
    item: Omit<AIProvider, 'id'> & { id?: string | undefined }
  ): Promise<AIProvider> {
    const providerOrBaseUrl =
      item.type === AIProviderType.Custom
        ? item.extraFields.apiBaseUrl
        : item.type

    // Handle the case where providerOrBaseUrl might be undefined
    if (!providerOrBaseUrl) {
      throw new Error(t('extension.aiProvider.providerOrBaseUrlRequired'))
    }

    const newModels = await findNewModel(
      removeDuplicates([...item.manualModels, ...item.realTimeModels]),
      providerOrBaseUrl
    )

    // Add models one by one to avoid type error
    await aiModelDB.batchAdd(newModels)

    return await super.add(item)
  }
}

export const aiProviderDB = new AIProviderDB()
