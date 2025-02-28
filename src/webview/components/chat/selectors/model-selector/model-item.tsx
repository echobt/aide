import React from 'react'
import { CheckIcon } from '@radix-ui/react-icons'
import { type AIModel } from '@shared/entities'
import { cn } from '@webview/utils/common'

import {
  getModelFeatures,
  getPrimaryModelFeature,
  modelFeatureConfigMap
} from './constants'

export interface ModelItemProps {
  model: AIModel
  isSelected: boolean
  onSelect: () => void
}

export const ModelItem: React.FC<ModelItemProps> = ({
  model,
  isSelected,
  onSelect
}) => {
  // get the primary feature of the model
  const primaryFeature = getPrimaryModelFeature(model.name)
  const allFeatures = getModelFeatures(model.name)

  // get feature label and color
  const featureLabel = primaryFeature
    ? modelFeatureConfigMap[primaryFeature].label
    : null
  const featureColor = primaryFeature
    ? modelFeatureConfigMap[primaryFeature].color
    : 'text-muted-foreground'
  const featureBgColor = primaryFeature
    ? modelFeatureConfigMap[primaryFeature].bgColor
    : 'bg-muted/30'

  const getDisplayNameForProviderOrBaseUrl = (providerOrBaseUrl: string) => {
    try {
      const url = new URL(providerOrBaseUrl)
      return url.hostname
    } catch (error) {
      return providerOrBaseUrl
    }
  }

  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex items-center justify-between p-2 rounded-md cursor-pointer',
        'transition-all duration-200 border border-transparent',
        'hover:border-border/50 hover:shadow-md hover:bg-accent/80',
        isSelected
          ? 'bg-primary/90 text-primary-foreground shadow-sm border-primary/50'
          : 'bg-card/30 hover:translate-y-[-2px]'
      )}
    >
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate flex items-center">
            {model.name}

            {primaryFeature && (
              <span className={cn('size-4 ml-2', featureColor, 'inline-block')}>
                {modelFeatureConfigMap[primaryFeature].icon}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="text-xs truncate max-w-[200px] text-foreground/50">
            {getDisplayNameForProviderOrBaseUrl(model.providerOrBaseUrl)}
          </div>
          {featureLabel && (
            <div
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                featureBgColor,
                featureColor
              )}
            >
              {featureLabel}
            </div>
          )}
          {allFeatures.length > 1 && (
            <div className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground">
              +{allFeatures.length - 1}
            </div>
          )}
        </div>
      </div>
      {isSelected && (
        <div className="size-6 shrink-0 rounded-full bg-primary-foreground/20 flex items-center justify-center">
          <CheckIcon className="size-4 shrink-0" />
        </div>
      )}
    </div>
  )
}
