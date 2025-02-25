import { useEffect, useState } from 'react'
import type { AIModel, AIModelFeature, AIProvider } from '@shared/entities'
import { AIModelEntity, AIProviderType } from '@shared/entities'
import { removeDuplicates, signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@webview/components/ui/button'
import { api } from '@webview/network/actions-api'
import { cn, logAndToastError } from '@webview/utils/common'
import { Loader2Icon, RefreshCcwIcon } from 'lucide-react'

import { modelsQueryKey } from '../provider-form/provider-utils'
import { CreateModelDialog } from './create-model-dialog'
import { ManualModelList } from './manual-model-list'
import { RemoteModelList } from './remote-model-list'

const getDefaultAIModel = (
  name: string,
  providerOrBaseUrl: AIProviderType | string
): AIModel =>
  new AIModelEntity({
    name,
    providerOrBaseUrl
  }).entity

interface ModelFormProps {
  className?: string
  provider: AIProvider
  setProvider: (data: AIProvider) => void
}

export const ModelForm = ({
  className,
  provider,
  setProvider
}: ModelFormProps) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const providerOrBaseUrl =
    provider.type === AIProviderType.Custom
      ? provider.extraFields.apiBaseUrl
      : provider.type

  const useRemote = provider.allowRealTimeModels
  const setUseRemote = (value: boolean) => {
    setProvider({
      ...provider,
      allowRealTimeModels: value
    })
  }

  useEffect(() => {
    if (useRemote) {
      updateProviderRemoteModelsMutation.mutate()
    }
  }, [useRemote])

  const { data: models = [], refetch: refetchAllModelsInfo } = useQuery({
    queryKey: [modelsQueryKey, providerOrBaseUrl],
    queryFn: ({ signal }) =>
      api.actions().server.aiModel.getModelsByProviderOrBaseUrl({
        actionParams: {
          providerOrBaseUrl: providerOrBaseUrl!
        },
        abortController: signalToController(signal)
      }),
    enabled: !!providerOrBaseUrl
  })

  const updateProviderRemoteModelsMutation = useMutation({
    mutationFn: async () => {
      if (!provider.type) return
      const remoteModelNames = await api
        .actions()
        .server.aiModel.fetchRemoteModelNames({
          actionParams: {
            provider
          }
        })
      setProvider({
        ...provider,
        realTimeModels: remoteModelNames
      })
    },
    onError: error => {
      logAndToastError('Failed to update provider remote models', error)
    }
  })

  const manualModels = provider.manualModels.map(
    name =>
      models.find(m => m.name === name) ||
      getDefaultAIModel(name, providerOrBaseUrl!)
  )

  const remoteModels = provider.realTimeModels
    .map(
      name =>
        models.find(m => m.name === name) ||
        getDefaultAIModel(name, providerOrBaseUrl!)
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  const updateModelMutation = useMutation({
    mutationFn: (model: AIModel) =>
      api.actions().server.aiModel.createOrUpdateModel({
        actionParams: model
      }),
    onSuccess: () => {
      refetchAllModelsInfo()
    }
  })

  const handleAddModels = (modelNames: string[]) => {
    setProvider({
      ...provider,
      manualModels: removeDuplicates([...provider.manualModels, ...modelNames])
    })
  }

  const handleDeleteModels = (modelNames: string[]) => {
    setProvider({
      ...provider,
      manualModels: provider.manualModels.filter(
        name => !modelNames.includes(name)
      )
    })
  }

  const handleReorderModels = (models: AIModel[]) => {
    setProvider({
      ...provider,
      manualModels: models.map(m => m.name)
    })
  }

  const handleTestModelFeatures = async (
    model: AIModel,
    features: AIModelFeature[]
  ) => {
    try {
      const result = await api.actions().server.aiModel.testModelFeatures({
        actionParams: {
          provider,
          model,
          features
        }
      })
      await updateModelMutation.mutateAsync({
        ...model,
        ...result
      })
    } catch (error) {
      logAndToastError('Failed to test model features', error)
    }
  }

  const handleDeleteModel = (model: AIModel) => {
    setProvider({
      ...provider,
      manualModels: provider.manualModels.filter(name => name !== model.name)
    })
  }

  const handleAddToManual = (model: AIModel) => {
    if (!provider.manualModels.includes(model.name)) {
      setProvider({
        ...provider,
        manualModels: [...provider.manualModels, model.name]
      })
    }
  }

  const handleRemoveFromManual = (model: AIModel) => {
    setProvider({
      ...provider,
      manualModels: provider.manualModels.filter(name => name !== model.name)
    })
  }

  return (
    <div className={cn('space-y-4', className)}>
      <CreateModelDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleAddModels}
      />

      {/* <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Model Management</h3>
      </div> */}

      <ManualModelList
        models={manualModels}
        onReorderModels={handleReorderModels}
        onDeleteModels={models => {
          handleDeleteModels(models.map(m => m.name))
        }}
        onDeleteModel={handleDeleteModel}
        onCreateModel={() => setIsCreateDialogOpen(true)}
        onTestModelFeatures={handleTestModelFeatures}
      />

      <RemoteModelList
        models={remoteModels}
        manualModelNames={provider.manualModels}
        enabled={useRemote}
        onEnabledChange={setUseRemote}
        onTestModelFeatures={handleTestModelFeatures}
        onAddToManual={handleAddToManual}
        onRemoveFromManual={handleRemoveFromManual}
        headerLeftActions={
          // refresh models button
          <Button
            variant="ghost"
            size="iconXs"
            onClick={() => updateProviderRemoteModelsMutation.mutate()}
            disabled={updateProviderRemoteModelsMutation.isPending}
          >
            {updateProviderRemoteModelsMutation.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <RefreshCcwIcon className="size-4" />
            )}
          </Button>
        }
      />
    </div>
  )
}
