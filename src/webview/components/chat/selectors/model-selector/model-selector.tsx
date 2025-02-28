import React, { useState } from 'react'
import {
  AIProviderType,
  createModelSettingKeyTitleMap,
  FeatureModelSettingKey,
  type AIModel,
  type AIProvider,
  type FeatureModelSettingValue
} from '@shared/entities'
import { removeDuplicates, signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { QueryStateWrapper } from '@webview/components/query-state-wrapper'
import { ProviderFormDialog } from '@webview/components/settings/custom-renders/ai-provider-management/provider-form-dialog'
import {
  modelsQueryKey,
  providersQueryKey
} from '@webview/components/settings/custom-renders/ai-provider-management/provider-form/provider-utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@webview/components/ui/popover'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { useOpenSettingsPage } from '@webview/hooks/api/use-open-settings-page'
import { useControllableState } from '@webview/hooks/use-controllable-state'
import { api } from '@webview/network/actions-api'
import { useTranslation } from 'react-i18next'

import { ModelSelectorContent } from './model-selector-content'

interface ModelSelectorProps {
  featureModelSettingKey: FeatureModelSettingKey
  open?: boolean
  onOpenChange?: (open: boolean) => void
  renderTrigger: (props: {
    activeProvider?: AIProvider
    activeModel?: AIModel
    tooltip: string
    title: string
  }) => React.ReactNode
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  featureModelSettingKey,
  open,
  onOpenChange,
  renderTrigger
}) => {
  const { t } = useTranslation()
  const { openSettingsPage } = useOpenSettingsPage()
  const [isOpen, setIsOpen] = useControllableState({
    prop: open,
    defaultProp: false,
    onChange: onOpenChange
  })
  const { invalidateQueries } = useInvalidateQueries()
  const [editingProvider, setEditingProvider] = useState<
    AIProvider | undefined
  >()
  const [isAddingProvider, setIsAddingProvider] = useState(false)

  const {
    data: defaultFeatureModelSetting,
    isLoading: isLoadingDefaultFeatureModelSetting
  } = useQuery({
    queryKey: ['featureModelSetting', FeatureModelSettingKey.Default],
    queryFn: () =>
      api.actions().server.aiModel.getProviderAndModelForFeature({
        actionParams: {
          key: FeatureModelSettingKey.Default
        }
      }),
    refetchOnMount: true
  })

  const { data: featureModelSetting, isLoading: isLoadingFeatureModelSetting } =
    useQuery({
      queryKey: ['featureModelSetting', featureModelSettingKey],
      queryFn: () =>
        api.actions().server.aiModel.getProviderAndModelForFeature({
          actionParams: {
            key: featureModelSettingKey
          }
        }),
      refetchOnMount: true
    })

  const updateFeatureModelSettingMutation = useMutation({
    mutationFn: (req: {
      key: FeatureModelSettingKey
      value: FeatureModelSettingValue
    }) =>
      api.actions().server.aiModel.setModelSettingForFeature({
        actionParams: req
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['featureModelSetting', featureModelSettingKey]
      })
    }
  })

  const { data: providers = [], isLoading: isLoadingProviders } = useQuery({
    queryKey: [providersQueryKey],
    queryFn: ({ signal }) =>
      api.actions().server.aiProvider.getProviders({
        actionParams: {},
        abortController: signalToController(signal)
      }),
    refetchOnMount: true
  })

  const { data: models = [], isLoading: isLoadingModels } = useQuery({
    queryKey: [modelsQueryKey],
    queryFn: ({ signal }) =>
      api.actions().server.aiModel.getModels({
        actionParams: {},
        abortController: signalToController(signal)
      }),
    refetchOnMount: true
  })

  const isLoading =
    isLoadingDefaultFeatureModelSetting ||
    isLoadingFeatureModelSetting ||
    isLoadingProviders ||
    isLoadingModels

  const providerOrBaseUrlModelsMap = models.reduce<Record<string, AIModel[]>>(
    (acc, model) => {
      acc[model.providerOrBaseUrl] = acc[model.providerOrBaseUrl] || []
      acc[model.providerOrBaseUrl]?.push(model)
      return acc
    },
    {}
  )

  const providerIdModelsMap = providers.reduce<Record<string, AIModel[]>>(
    (acc, provider) => {
      const providerTypeOrBaseUrl =
        provider.type === AIProviderType.Custom
          ? provider.extraFields.apiBaseUrl
          : provider.type

      if (!providerTypeOrBaseUrl) return acc

      const modelNames = removeDuplicates([
        ...provider.manualModels,
        ...provider.realTimeModels
      ])

      acc[provider.id] = (
        providerOrBaseUrlModelsMap[providerTypeOrBaseUrl] || []
      ).filter(model => modelNames.includes(model.name))
      return acc
    },
    {}
  )

  const handleAddProvider = async (data: Partial<AIProvider>) => {
    const order = providers.length + 1
    await api.actions().server.aiProvider.addProvider({
      actionParams: { ...data, order } as Omit<AIProvider, 'id'>
    })
    setIsAddingProvider(false)
    await invalidateQueries({
      type: 'all-webview',
      queryKeys: [providersQueryKey]
    })
    await invalidateQueries({
      type: 'all-webview',
      queryKeys: [modelsQueryKey]
    })
  }

  const handleOpenProvidersManagement = () => {
    openSettingsPage({ pageId: 'chatModel' })
  }

  const handleEditProvider = (provider: AIProvider) => {
    setEditingProvider(provider)
  }

  const handleSelectModel = (
    providerId: string | undefined,
    modelName: string | undefined
  ) => {
    updateFeatureModelSettingMutation.mutate({
      key: featureModelSettingKey,
      value: {
        providerId,
        modelName
      }
    })
  }

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {renderTrigger({
            activeProvider: featureModelSetting?.provider,
            activeModel: featureModelSetting?.model,
            tooltip:
              featureModelSetting?.model ||
              featureModelSettingKey !== FeatureModelSettingKey.Default
                ? `${
                    featureModelSetting?.provider?.name ??
                    defaultFeatureModelSetting?.provider?.name ??
                    t('webview.modelSelector.default')
                  } > ${
                    featureModelSetting?.model?.name ??
                    (defaultFeatureModelSetting?.model?.name
                      ? `${defaultFeatureModelSetting?.model?.name} (${t('webview.modelSelector.default')})`
                      : t('webview.modelSelector.extendsDefault'))
                  }`
                : t('webview.modelSelector.selectModel'),
            title:
              featureModelSetting?.model ||
              featureModelSettingKey !== FeatureModelSettingKey.Default
                ? (featureModelSetting?.model?.name ??
                  (defaultFeatureModelSetting?.model?.name
                    ? `${defaultFeatureModelSetting?.model?.name} (${t('webview.modelSelector.default')})`
                    : t('webview.modelSelector.extendsDefault')))
                : t('webview.modelSelector.selectModel')
          })}
        </PopoverTrigger>
        <PopoverContent
          className="w-[calc(100vw-2rem)] max-w-[400px] p-0"
          updatePositionStrategy="optimized"
          side="bottom"
          align="start"
          withBlur
        >
          <div className="flex flex-col w-full">
            <div className="flex items-center opacity-50 text-xs justify-center w-full py-1 border-b">
              {createModelSettingKeyTitleMap(t)[featureModelSettingKey]}{' '}
              {t('webview.modelSelector.setting')}
            </div>
            <QueryStateWrapper
              isLoading={isLoading}
              isEmpty={!providers.length || !models.length}
              emptyMessage={t('webview.modelSelector.noModelsAvailable')}
            >
              <ModelSelectorContent
                providers={providers}
                models={models}
                providerIdModelsMap={providerIdModelsMap}
                selectedProviderId={featureModelSetting?.provider?.id}
                selectedModelName={featureModelSetting?.model?.name}
                featureModelSettingKey={featureModelSettingKey}
                defaultFeatureModelSetting={defaultFeatureModelSetting}
                onSelectModel={handleSelectModel}
                onEditProvider={handleEditProvider}
                onAddProvider={() => setIsAddingProvider(true)}
                onManageProviders={handleOpenProvidersManagement}
              />
            </QueryStateWrapper>
          </div>
        </PopoverContent>
      </Popover>

      <ProviderFormDialog
        open={!!editingProvider}
        onOpenChange={open => !open && setEditingProvider(undefined)}
        initialProvider={editingProvider}
        onSubmit={async data => {
          await api.actions().server.aiProvider.updateProvider({
            actionParams: {
              ...data,
              id: editingProvider?.id
            } as AIProvider
          })
          setEditingProvider(undefined)
          invalidateQueries({
            type: 'all-webview',
            queryKeys: [providersQueryKey]
          })
          invalidateQueries({
            type: 'all-webview',
            queryKeys: [modelsQueryKey]
          })
        }}
      />

      <ProviderFormDialog
        open={isAddingProvider}
        onOpenChange={setIsAddingProvider}
        onSubmit={handleAddProvider}
      />
    </>
  )
}
