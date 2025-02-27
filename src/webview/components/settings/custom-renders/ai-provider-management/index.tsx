import { useState } from 'react'
import {
  AIProviderType,
  FeatureModelSettingKey,
  type AIProvider
} from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CardList } from '@webview/components/ui/card-list'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ModelSettings } from './model-settings'
import { ProviderCard } from './provider-card'
import { ProviderFormDialog } from './provider-form-dialog'
import {
  modelsQueryKey,
  providersQueryKey
} from './provider-form/provider-utils'
import { ProviderUsageDialog } from './provider-usage-dialog'

export const AIProviderManagement = () => {
  const { t } = useTranslation()
  const [editingProvider, setEditingProvider] = useState<
    AIProvider | undefined
  >()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedProviderForUsage, setSelectedProviderForUsage] = useState<
    AIProvider | undefined
  >()
  const { invalidateQueries } = useInvalidateQueries()

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
      invalidateQueries({
        type: 'all-webview',
        queryKeys: [providersQueryKey]
      })
      invalidateQueries({
        type: 'all-webview',
        queryKeys: [modelsQueryKey]
      })
      toast.success(t('webview.aiProvider.providerAddedSuccess'))
      setIsDialogOpen(false)
    },
    onError: error => {
      logAndToastError(t('webview.aiProvider.failedToAddProvider'), error)
    }
  })

  const updateProviderMutation = useMutation({
    mutationFn: (data: AIProvider) =>
      api.actions().server.aiProvider.updateProvider({
        actionParams: data
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: [providersQueryKey]
      })
      invalidateQueries({
        type: 'all-webview',
        queryKeys: [modelsQueryKey]
      })
      toast.success(t('webview.aiProvider.providerUpdatedSuccess'))
      setIsDialogOpen(false)
    },
    onError: error => {
      logAndToastError(t('webview.aiProvider.failedToUpdateProvider'), error)
    }
  })

  const removeProviderMutation = useMutation({
    mutationFn: (providers: AIProvider[]) =>
      api.actions().server.aiProvider.removeProviders({
        actionParams: providers.map(p => ({ id: p.id }))
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: [providersQueryKey]
      })
      invalidateQueries({
        type: 'all-webview',
        queryKeys: [modelsQueryKey]
      })
      toast.success(t('webview.aiProvider.providersRemovedSuccess'))
    },
    onError: error => {
      logAndToastError(t('webview.aiProvider.failedToRemoveProviders'), error)
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
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: [providersQueryKey]
      })
    }
  })

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

  const optimizeProviders = reorderProvidersMutation.isPending
    ? reorderProvidersMutation.variables
    : providers

  const handleSubmit = async (data: Partial<AIProvider>) => {
    const order = optimizeProviders.length + 1
    if (editingProvider) {
      updateProviderMutation.mutate({
        ...editingProvider,
        ...data,
        order,
        id: editingProvider.id
      } as AIProvider)
    } else {
      addProviderMutation.mutate(data as Omit<AIProvider, 'id'>)
    }
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

  const handleViewUsage = (provider: AIProvider) => {
    setSelectedProviderForUsage(provider)
  }

  const isAllowViewUsage = (provider: AIProvider) =>
    [AIProviderType.Aide].includes(provider.type)

  return (
    <div className="space-y-4">
      <ProviderFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialProvider={editingProvider}
        onSubmit={handleSubmit}
      />

      <ProviderUsageDialog
        provider={selectedProviderForUsage}
        onOpenChange={open => !open && setSelectedProviderForUsage(undefined)}
      />

      <ModelSettings pinnedKeys={[FeatureModelSettingKey.Default]} />

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
            showUsage={isAllowViewUsage(provider)}
            onSelect={onSelect}
            onViewUsage={handleViewUsage}
          />
        )}
      />
    </div>
  )
}
