import React, { useEffect, useMemo } from 'react'
import {
  CheckIcon,
  Cross2Icon,
  GearIcon,
  MagnifyingGlassIcon,
  Pencil2Icon,
  PlusIcon,
  StarFilledIcon
} from '@radix-ui/react-icons'
import {
  FeatureModelSettingKey,
  type AIModel,
  type AIProvider
} from '@shared/entities'
import { ButtonWithTooltip } from '@webview/components/button-with-tooltip'
import { Badge } from '@webview/components/ui/badge'
import { Button } from '@webview/components/ui/button'
import { Input } from '@webview/components/ui/input'
import { ScrollArea } from '@webview/components/ui/scroll-area'
import { cn } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'

import { DefaultOption } from './default-option'
import { useModelFiltering } from './hooks/use-model-filtering'
import { useProviderSelection } from './hooks/use-provider-selection'
import { useRecentModels } from './hooks/use-recent-models'
import { useSearch } from './hooks/use-search'
import { ModelItem } from './model-item'
import { ProviderItem } from './provider-item'

export interface ModelSelectorContentProps {
  providers: AIProvider[]
  models: AIModel[]
  providerIdModelsMap: Record<string, AIModel[]>
  selectedProviderId?: string
  selectedModelName?: string
  featureModelSettingKey: FeatureModelSettingKey
  defaultFeatureModelSetting?: {
    provider?: AIProvider
    model?: AIModel
  }
  onSelectModel: (
    providerId: string | undefined,
    modelName: string | undefined
  ) => void
  onEditProvider: (provider: AIProvider) => void
  onAddProvider: () => void
  onManageProviders: () => void
}

export const ModelSelectorContent: React.FC<ModelSelectorContentProps> = ({
  providers,
  models,
  providerIdModelsMap,
  selectedProviderId,
  selectedModelName,
  featureModelSettingKey,
  defaultFeatureModelSetting,
  onSelectModel,
  onEditProvider,
  onAddProvider,
  onManageProviders
}) => {
  const { t } = useTranslation()
  const { searchQuery, setSearchQuery, filteredProviders, clearSearch } =
    useSearch(providers)

  const {
    selectedProvider,
    showDefaultOption,
    handleProviderSelect,
    handleDefaultSelect
  } = useProviderSelection(
    providers,
    selectedProviderId,
    featureModelSettingKey
  )

  const { filteredModels, categorizedModels } = useModelFiltering(
    selectedProvider,
    providerIdModelsMap,
    searchQuery
  )

  const { addRecentModel, findRecentModelsFromList } = useRecentModels()

  // when model is selected, add to recent used models
  useEffect(() => {
    if (selectedModelName && selectedProviderId) {
      const provider = providers.find(p => p.id === selectedProviderId)
      const model = models.find(m => m.name === selectedModelName)
      if (provider && model) {
        addRecentModel(model, provider)
      }
    }
  }, [selectedModelName, selectedProviderId, providers, models, addRecentModel])

  // get recent used models
  const recentlyUsedModels = findRecentModelsFromList(models, providers)

  // get popular and regular models from categorized models
  const { popular: popularModelNames, regular: regularModelNames } =
    categorizedModels

  const modelNameModelMap = useMemo(
    () =>
      models.reduce(
        (acc, model) => {
          acc[model.name] = model
          return acc
        },
        {} as Record<string, AIModel>
      ),
    [models]
  )

  // Create a mapping from model name to provider id for faster lookups
  const modelNameToProviderMap = useMemo(() => {
    const map: Record<string, string> = {}

    Object.entries(providerIdModelsMap).forEach(
      ([providerId, providerModels]) => {
        providerModels.forEach(model => {
          map[model.name] = providerId
        })
      }
    )

    return map
  }, [providerIdModelsMap])

  return (
    <div className="flex flex-col h-[450px] bg-gradient-to-b from-background to-background/95">
      {/* search bar */}
      <div className="px-2 py-1 bg-muted/20 backdrop-blur-sm">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('webview.modelSelector.searchModelsOrProviders')}
            className="pl-8 h-8 text-sm bg-background/80 border-muted-foreground/20 rounded-md"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 size-6 p-0"
              onClick={clearSearch}
            >
              <Cross2Icon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* recently used models - only show when not searching */}
      {!searchQuery && recentlyUsedModels.length > 0 && (
        <div className="p-2 border-b">
          <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
            <StarFilledIcon className="size-3 mr-1.5 text-amber-500" />
            {t('webview.modelSelector.recentlyUsed')}
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentlyUsedModels.map(model => (
              <div
                key={model.id}
                className="flex items-center gap-1 p-1 bg-accent/50 rounded-full text-xs cursor-pointer hover:bg-accent transition-colors whitespace-nowrap"
                onClick={() => {
                  const providerId = modelNameToProviderMap[model.name]
                  if (providerId) {
                    const provider = providers.find(p => p.id === providerId)
                    if (provider) {
                      handleProviderSelect(provider)
                      onSelectModel(providerId, model.name)
                    }
                  }
                }}
              >
                <span>{model.name}</span>
                {selectedModelName === model.name && (
                  <CheckIcon className="h-3 w-3 text-primary" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* providers list */}
        <div className="w-[38%] shrink-0 border-r flex flex-col bg-muted/5">
          <div className="h-8 px-2 text-xs font-medium text-muted-foreground border-b flex items-center justify-between">
            <span className="flex items-center">
              {t('webview.modelSelector.providers')}
              <Badge
                variant="outline"
                className="ml-2 h-4 px-1.5 text-[10px] bg-muted/30"
              >
                {filteredProviders.length}
              </Badge>
            </span>
            <Button
              variant="ghost"
              size="iconXss"
              className="shrink-0 hover:bg-accent/50"
              onClick={onAddProvider}
            >
              <PlusIcon className="size-3" />
            </Button>
          </div>
          <ScrollArea
            className="flex-1"
            viewPortProps={{ className: '[&>div]:!block' }}
          >
            <div className="p-2 space-y-1">
              {featureModelSettingKey !== FeatureModelSettingKey.Default && (
                <div
                  className={cn(
                    'p-2 rounded-md cursor-pointer transition-all',
                    'text-sm font-medium flex items-center',
                    showDefaultOption
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-accent/50 hover:translate-x-[2px]'
                  )}
                  onClick={handleDefaultSelect}
                >
                  {t('webview.modelSelector.default')}
                </div>
              )}

              {filteredProviders.map(provider => (
                <ProviderItem
                  key={provider.id}
                  provider={provider}
                  isSelected={selectedProvider?.id === provider.id}
                  onSelect={() => handleProviderSelect(provider)}
                  onEdit={() => onEditProvider(provider)}
                />
              ))}

              {filteredProviders.length === 0 && searchQuery && (
                <div className="text-sm text-muted-foreground p-2 text-center rounded-md bg-muted/10 mt-2">
                  {t('webview.modelSelector.noProvidersFound')}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* models list */}
        <div className="overflow-hidden flex-1 flex flex-col bg-gradient-to-br from-background/50 to-background">
          {showDefaultOption ? (
            <DefaultOption
              defaultFeatureModelSetting={defaultFeatureModelSetting}
              onSelect={() => onSelectModel(undefined, undefined)}
              isSelected={!selectedProviderId && !selectedModelName}
            />
          ) : (
            <>
              <div className="h-8 px-2 text-xs font-medium text-muted-foreground border-b flex items-center justify-between bg-muted/10 backdrop-blur-sm">
                <span className="flex items-center">
                  <span className="font-semibold text-foreground">
                    {selectedProvider?.name}
                  </span>
                  <span className="mx-1.5">•</span>
                  <span>
                    {t('webview.modelSelector.models')}
                    <Badge
                      variant="outline"
                      className="ml-2 h-5 px-1.5 text-[10px] bg-muted/30"
                    >
                      {filteredModels.length}
                    </Badge>
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="iconXs"
                  className="shrink-0 hover:bg-primary/20 h-6 w-6"
                  onClick={() =>
                    selectedProvider && onEditProvider(selectedProvider)
                  }
                >
                  <Pencil2Icon className="size-3" />
                </Button>
              </div>
              <ScrollArea
                className="flex-1"
                viewPortProps={{ className: '[&>div]:!block' }}
              >
                {popularModelNames.length > 0 && (
                  <div className="pt-3 px-3">
                    <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
                      <StarFilledIcon className="h-3 w-3 mr-1.5 text-amber-500" />
                      {t('webview.modelSelector.popularModels')}
                    </h3>
                    <div className="space-y-1.5">
                      {popularModelNames.map(modelName => {
                        const model = modelNameModelMap[modelName]
                        if (!model) return null

                        return (
                          <ModelItem
                            key={modelName}
                            model={model}
                            isSelected={
                              selectedProviderId === selectedProvider?.id &&
                              selectedModelName === modelName
                            }
                            onSelect={() =>
                              onSelectModel(selectedProvider?.id, modelName)
                            }
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

                {regularModelNames.length > 0 && (
                  <div className="pt-3 px-3 pb-3">
                    {popularModelNames.length > 0 && (
                      <h3 className="text-xs font-medium text-muted-foreground mb-2 mt-3">
                        {t('webview.modelSelector.otherModels')}
                      </h3>
                    )}
                    <div className="space-y-1.5">
                      {regularModelNames.map(modelName => {
                        const model = modelNameModelMap[modelName]
                        if (!model) return null

                        return (
                          <ModelItem
                            key={modelName}
                            model={model}
                            isSelected={
                              selectedProviderId === selectedProvider?.id &&
                              selectedModelName === modelName
                            }
                            onSelect={() =>
                              onSelectModel(selectedProvider?.id, modelName)
                            }
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

                {filteredModels.length === 0 && (
                  <div className="text-sm text-muted-foreground p-6 text-center rounded-md bg-muted/5 m-3">
                    {searchQuery
                      ? t('webview.modelSelector.noModelsFound')
                      : t('webview.modelSelector.noModelsForProvider')}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      </div>

      {/* bottom action bar */}
      <div className="flex items-center justify-between p-2 border-t bg-muted/10 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <ButtonWithTooltip
            size="xs"
            variant="outline"
            onClick={onAddProvider}
            tooltip={t('webview.modelSelector.addNewProvider')}
            className="text-xs gap-2 bg-background/80 hover:bg-accent/80 transition-colors"
          >
            <PlusIcon className="size-3" />
            <span>{t('webview.modelSelector.addProvider')}</span>
          </ButtonWithTooltip>

          <ButtonWithTooltip
            size="xs"
            variant="outline"
            onClick={onManageProviders}
            tooltip={t('webview.modelSelector.manageProviders')}
            className="text-xs gap-2 bg-background/80 hover:bg-accent/80 transition-colors"
          >
            <GearIcon className="size-3" />
            <span>{t('webview.modelSelector.manage')}</span>
          </ButtonWithTooltip>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded-full">
          {models.length} {t('webview.modelSelector.totalModels')}
        </div>
      </div>
    </div>
  )
}
