import React from 'react'
import {
  CheckIcon,
  InfoCircledIcon,
  MixerHorizontalIcon,
  Pencil2Icon,
  StarFilledIcon
} from '@radix-ui/react-icons'
import {
  FeatureModelSettingKey,
  type AIModel,
  type AIProvider
} from '@shared/entities'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { cn } from '@webview/utils/common'
import { t } from 'i18next'
import { useTranslation } from 'react-i18next'

import { getProviderColor, getProviderIcon } from './constants'
import { ModelSelector } from './model-selector'

export interface DefaultOptionProps {
  defaultFeatureModelSetting?: {
    provider?: AIProvider
    model?: AIModel
  }
  isSelected: boolean
  onSelect: () => void
}

export const DefaultOption: React.FC<DefaultOptionProps> = ({
  defaultFeatureModelSetting,
  isSelected,
  onSelect
}) => {
  const { t } = useTranslation()
  const provider = defaultFeatureModelSetting?.provider
  const model = defaultFeatureModelSetting?.model

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background/80 to-background">
      <div className="h-8 px-2 text-xs font-medium text-muted-foreground border-b flex items-center bg-muted/10 backdrop-blur-sm">
        <MixerHorizontalIcon className="size-3 mr-1.5" />
        <span>{t('webview.modelSelector.defaultSettings')}</span>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div
          onClick={onSelect}
          className={cn(
            'flex items-center justify-between p-4 rounded-md cursor-pointer mb-5',
            'transition-all duration-200 hover:shadow-md border',
            isSelected
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card/50 hover:translate-y-[-2px] border-border/50 hover:border-primary/30'
          )}
        >
          <div className="flex flex-col">
            <div className="font-medium flex items-center">
              {t('webview.modelSelector.extendsDefault')}
              <StarFilledIcon className="size-3 ml-2 text-amber-500" />
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {t('webview.modelSelector.useDefaultSettings')}
            </div>
          </div>
          {isSelected && (
            <div className="h-6 w-6 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <CheckIcon className="size-4 shrink-0" />
            </div>
          )}
        </div>

        <div className="rounded-md border bg-card/30 overflow-hidden shadow-sm">
          <div className="p-2 text-xs font-medium bg-muted/30 border-b flex items-center justify-between">
            <span>{t('webview.modelSelector.currentDefaultModel')}</span>
            <ModelSelector
              featureModelSettingKey={FeatureModelSettingKey.Default}
              renderTrigger={({ tooltip, title }) => (
                <ButtonWithTooltip
                  tooltip={tooltip}
                  variant="outline"
                  size="iconXs"
                >
                  <Pencil2Icon className="size-4 text-muted-foreground" />
                </ButtonWithTooltip>
              )}
            />
          </div>
          <div className="p-2">
            <ModelSettingItem provider={provider} model={model} />
          </div>
        </div>

        <div className="mt-2 text-xs text-muted-foreground space-y-2 bg-muted/10 p-2">
          <div className="flex items-start">
            <InfoCircledIcon className="size-4 shrink-0 mr-2 mt-0.5 text-primary/70" />
            {t('webview.modelSelector.defaultExplanation')}
          </div>
        </div>
      </div>
    </div>
  )
}

// model setting item component
const ModelSettingItem = ({
  provider,
  model
}: {
  provider?: AIProvider
  model?: AIModel
}) => {
  if (!provider || !model) {
    return (
      <div className="text-sm text-muted-foreground italic">
        {t('webview.modelSelector.noDefaultSet')}
      </div>
    )
  }

  const providerIcon = getProviderIcon(provider.type, provider.name)
  const providerColor = getProviderColor(provider.type, provider.name)

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/10">
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-white',
          providerColor
        )}
      >
        <span className="text-sm">{providerIcon}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{model.name}</span>
        <span className="text-xs text-muted-foreground">{provider.name}</span>
      </div>
    </div>
  )
}
