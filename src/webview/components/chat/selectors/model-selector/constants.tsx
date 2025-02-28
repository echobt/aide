/* eslint-disable no-useless-escape */
import React from 'react'
import {
  CodeIcon,
  DrawingPinIcon,
  EyeOpenIcon,
  LightningBoltIcon,
  MixIcon,
  StarFilledIcon
} from '@radix-ui/react-icons'
import { AIProviderType } from '@shared/entities'
import { removeDuplicates } from '@shared/utils/common'

// Model feature enumeration
export enum ModelFeature {
  VISION = 'vision',
  FAST = 'fast',
  POPULAR = 'popular',
  CODING = 'coding',
  REASONING = 'reasoning',
  CREATIVE = 'creative'
}

// Provider configuration interface
export interface ProviderInfoConfig {
  icon: React.ReactNode
  color: string
  bgColor: string
}

// Feature label configuration
export interface FeatureInfoConfig {
  label: string
  color: string
  bgColor: string
  icon: React.ReactNode
  priority: number
}

// Model feature configuration
export interface ModelFeatureConfig {
  features: ModelFeature[]
  priority: number
  detectionRules: {
    nameIncludes?: string[]
    nameRegex?: RegExp[]
  }
}

// Feature labels mapping
export const modelFeatureConfigMap: Record<ModelFeature, FeatureInfoConfig> = {
  [ModelFeature.VISION]: {
    label: 'vision',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    icon: <EyeOpenIcon className="h-3.5 w-3.5" />,
    priority: 5
  },
  [ModelFeature.FAST]: {
    label: 'fast',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    icon: <LightningBoltIcon className="h-3.5 w-3.5" />,
    priority: 3
  },
  [ModelFeature.POPULAR]: {
    label: 'popular',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    icon: <StarFilledIcon className="h-3.5 w-3.5" />,
    priority: 1
  },
  [ModelFeature.CODING]: {
    label: 'coding',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    icon: <CodeIcon className="h-3.5 w-3.5" />,
    priority: 4
  },
  [ModelFeature.REASONING]: {
    label: 'reasoning',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    icon: <MixIcon className="h-3.5 w-3.5" />,
    priority: 2
  },
  [ModelFeature.CREATIVE]: {
    label: 'creative',
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    icon: <DrawingPinIcon className="h-3.5 w-3.5" />,
    priority: 6
  }
}

// Provider info mapping
export const providerConfigMap: Record<AIProviderType, ProviderInfoConfig> = {
  [AIProviderType.OpenAI]: {
    icon: '',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-500/10'
  },
  [AIProviderType.Anthropic]: {
    icon: '',
    color: 'bg-red-500',
    bgColor: 'bg-red-500/10'
  },
  [AIProviderType.AzureOpenAI]: {
    icon: '',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-500/10'
  },
  [AIProviderType.Aide]: {
    icon: '',
    color: 'bg-violet-500',
    bgColor: 'bg-violet-500/10'
  },
  [AIProviderType.Custom]: {
    icon: '',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-500/10'
  },
  [AIProviderType.VSCodeLM]: {
    icon: '',
    color: 'bg-blue-600',
    bgColor: 'bg-blue-600/10'
  },
  [AIProviderType.Unknown]: {
    icon: '',
    color: 'bg-gray-500',
    bgColor: 'bg-gray-500/10'
  }
}

// Model feature detection configuration
export const modelFeatureConfigs: ModelFeatureConfig[] = [
  {
    features: [ModelFeature.VISION],
    priority: 5,
    detectionRules: {
      nameIncludes: [],
      nameRegex: [
        /vision/i,
        /dall-e/i,
        /midjourney/i,
        /stable-diffusion/i,
        /omni/i
      ]
    }
  },
  {
    features: [ModelFeature.FAST],
    priority: 3,
    detectionRules: {
      nameIncludes: ['turbo', 'fast', 'haiku', 'instant'],
      nameRegex: [/turbo/i, /fast/i, /mistral/i]
    }
  },
  {
    features: [ModelFeature.POPULAR],
    priority: 1,
    detectionRules: {
      nameIncludes: [],
      nameRegex: [
        /claude-3[-\.]5/i,
        /claude-3[-\.]7/i,
        /sonnet/i,
        /gemini-pro/i,
        /o1/i,
        /o3/i,
        /r1/i
      ]
    }
  },
  {
    features: [ModelFeature.CODING],
    priority: 4,
    detectionRules: {
      nameIncludes: ['code', 'coder', 'copilot', 'starcoder', 'codellama'],
      nameRegex: [/code/i, /copilot/i]
    }
  },
  {
    features: [ModelFeature.REASONING],
    priority: 2,
    detectionRules: {
      nameIncludes: ['deepseek-r1'],
      nameRegex: [/think/i, /reasoning/i, /o1/i, /o3/i]
    }
  },
  {
    features: [ModelFeature.CREATIVE],
    priority: 6,
    detectionRules: {
      nameIncludes: [],
      nameRegex: [/creative/i, /dall-e/i, /midjourney/i, /stable-diffusion/i]
    }
  },
  {
    features: [ModelFeature.VISION, ModelFeature.REASONING],
    priority: 5,
    detectionRules: {
      nameIncludes: [],
      nameRegex: [/o3/i, /o1/i]
    }
  }
]

/**
 * get all features of a model
 * @param modelName model name
 * @returns model features array
 */
export const getModelFeatures = (modelName: string): ModelFeature[] => {
  if (!modelName) return []

  const features: ModelFeature[] = []
  const lowerName = modelName.toLowerCase()

  for (const config of modelFeatureConfigs) {
    // check name includes
    if (
      config.detectionRules.nameIncludes?.some(term =>
        lowerName.includes(term.toLowerCase())
      )
    ) {
      features.push(...config.features)
      continue
    }

    // check name regex
    if (config.detectionRules.nameRegex?.some(regex => regex.test(lowerName))) {
      features.push(...config.features)
    }
  }

  // remove duplicates
  return removeDuplicates(features)
}

/**
 * get the primary feature of a model
 * @param modelName model name
 * @returns primary feature
 */
export const getPrimaryModelFeature = (
  modelName: string
): ModelFeature | null => {
  const features = getModelFeatures(modelName)
  if (features.length === 0) return null

  // sort by priority
  return (
    features.sort(
      (a, b) =>
        modelFeatureConfigMap[a].priority - modelFeatureConfigMap[b].priority
    )[0] || null
  )
}

/**
 * get provider icon
 * @param providerType provider type
 * @param providerName provider name (optional)
 * @returns icon react node
 */
export const getProviderIcon = (
  providerType: AIProviderType,
  // eslint-disable-next-line unused-imports/no-unused-vars
  providerName?: string
): React.ReactNode => {
  // custom provider can generate icon by name first letter
  if (providerType === AIProviderType.Custom && providerName) {
    return ''
  }

  return providerConfigMap[providerType]?.icon || ''
}

/**
 * get provider color
 * @param providerType provider type
 * @param providerName provider name (optional)
 * @returns color class name
 */
export const getProviderColor = (
  providerType: AIProviderType,
  // eslint-disable-next-line unused-imports/no-unused-vars
  providerName?: string
): string => providerConfigMap[providerType]?.color || 'bg-gray-500'
