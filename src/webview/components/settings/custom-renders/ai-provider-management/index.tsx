import { useState } from 'react'
import { FeatureModelSettingKey, type AIProvider } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CardList } from '@webview/components/ui/card-list'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { toast } from 'sonner'

import { ModelSettings } from './model-settings'
import { ProviderCard } from './provider-card'
import { ProviderDialog } from './provider-dialog'
import { modelsQueryKey, providersQueryKey } from './utils'

export const AIProviderManagement = () => {
  const queryClient = useQueryClient()
  const [editingProvider, setEditingProvider] = useState<
    AIProvider | undefined
  >(undefined)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data: providers = [] } = useQuery({
    queryKey: [providersQueryKey],
    queryFn: ({ signal }) =>
      api.actions().server.aiProvider.getProviders({
        actionParams: {},
        abortController: signalToController(signal)
      })
  })

  const addProviderMutation = useMutation({
    mutationFn: (data: Omit<AIProvider, 'id'>) =>
      api.actions().server.aiProvider.addProvider({
        actionParams: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providersQueryKey })
      queryClient.invalidateQueries({ queryKey: modelsQueryKey })
      toast.success('New provider added successfully')
      handleCloseDialog()
    },
    onError: error => {
      logAndToastError('Failed to save provider', error)
    }
  })

  const updateProviderMutation = useMutation({
    mutationFn: (data: AIProvider) =>
      api.actions().server.aiProvider.updateProvider({
        actionParams: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providersQueryKey })
      queryClient.invalidateQueries({ queryKey: modelsQueryKey })
      toast.success('Provider updated successfully')
    },
    onError: error => {
      logAndToastError('Failed to save provider', error)
    }
  })

  const removeProviderMutation = useMutation({
    mutationFn: (providers: AIProvider[]) =>
      Promise.all(
        providers.map(p =>
          api.actions().server.aiProvider.removeProvider({
            actionParams: { id: p.id }
          })
        )
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providersQueryKey })
      queryClient.invalidateQueries({ queryKey: modelsQueryKey })
      toast.success('Provider(s) removed successfully')
    },
    onError: error => {
      logAndToastError('Failed to remove provider(s)', error)
    }
  })

  const reorderProvidersMutation = useMutation({
    mutationFn: async (newProviders: AIProvider[]) => {
      const updates = newProviders.map(item => ({
        id: item.id,
        order: item.order
      }))

      return await api.actions().server.aiProvider.updateProviders({
        actionParams: updates
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: providersQueryKey })
      queryClient.invalidateQueries({ queryKey: modelsQueryKey })
    }
  })

  const optimizeProviders = reorderProvidersMutation.isPending
    ? reorderProvidersMutation.variables
    : providers

  const handleSubmit = async (data: Partial<AIProvider>) => {
    const order = optimizeProviders.length + 1
    if (editingProvider) {
      updateProviderMutation.mutate({
        ...data,
        order,
        id: editingProvider.id
      } as AIProvider)
    } else {
      addProviderMutation.mutate({ ...data, order } as Omit<AIProvider, 'id'>)
    }
  }

  const handleCreateProvider = () => {
    setEditingProvider(undefined)
    setIsDialogOpen(true)
  }

  const handleEditProvider = (provider: AIProvider) => {
    setEditingProvider(provider)
    setIsDialogOpen(true)
  }

  const handleRemoveProvider = (provider: AIProvider) => {
    removeProviderMutation.mutate([provider])
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingProvider(undefined)
  }

  const handleReorderProviders = (orderProviders: AIProvider[]) => {
    const newProviders = [...orderProviders]
      .reverse()
      .map((item, index) => ({
        ...item,
        order: index + 1
      }))
      .reverse()

    reorderProvidersMutation.mutate(newProviders)
  }

  return (
    <div className="space-y-6">
      <ProviderDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        provider={editingProvider}
        onSubmit={handleSubmit}
      />

      <ModelSettings
        className="mt-4"
        pinnedKeys={[FeatureModelSettingKey.Default]}
      />

      <CardList
        items={optimizeProviders}
        idField="id"
        draggable
        selectable
        onCreateItem={handleCreateProvider}
        onDeleteItems={removeProviderMutation.mutate}
        onReorderItems={handleReorderProviders}
        renderCard={({
          item: provider,
          dragHandleProps,
          isSelected,
          onSelect
        }) => (
          <ProviderCard
            provider={provider}
            onEdit={handleEditProvider}
            onRemove={handleRemoveProvider}
            dragHandleProps={dragHandleProps}
            isSelected={isSelected}
            onSelect={onSelect}
          />
        )}
      />
    </div>
  )
}
