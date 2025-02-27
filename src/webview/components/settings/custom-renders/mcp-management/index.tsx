import { useState } from 'react'
import { McpEntity, type McpConfig } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CardList } from '@webview/components/ui/card-list'
import { Input } from '@webview/components/ui/input'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useImmer } from 'use-immer'

import { McpCard } from './mcp-card'
import { McpDialog, type McpFormValues } from './mcp-dialog'

// Query key for Mcp configs
const mcpConfigsQueryKey = ['mcpConfigs'] as const

export const McpManagement = () => {
  const { t } = useTranslation()
  const { invalidateQueries } = useInvalidateQueries()
  const [config, setConfig] = useImmer<Partial<McpConfig>>(
    new McpEntity(t).entity
  )
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [reconnectingId, setReconnectingId] = useState<string | null>(null)

  // Queries
  const { data: mcpConfigs = [] } = useQuery({
    queryKey: [...mcpConfigsQueryKey, searchQuery],
    queryFn: ({ signal }) =>
      api.actions().server.mcp.getConfigsWithStatus({
        actionParams: { query: searchQuery },
        abortController: signalToController(signal)
      })
  })

  // Mutations
  const addConfigMutation = useMutation({
    mutationFn: (data: McpFormValues) =>
      api.actions().server.mcp.addConfig({
        actionParams: data
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: mcpConfigsQueryKey
      })
      toast.success(t('webview.mcp.addedSuccess'))
      handleCloseDialog()
    },
    onError: error => {
      logAndToastError(t('webview.mcp.failedToAdd'), error)
    }
  })

  const updateConfigMutation = useMutation({
    mutationFn: (data: McpFormValues & { id: string }) =>
      api.actions().server.mcp.updateConfig({
        actionParams: data
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: mcpConfigsQueryKey
      })
      toast.success(t('webview.mcp.updatedSuccess'))
      handleCloseDialog()
    },
    onError: error => {
      logAndToastError(t('webview.mcp.failedToUpdate'), error)
    }
  })

  const removeConfigsMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.actions().server.mcp.removeConfigs({
        actionParams: { ids }
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: mcpConfigsQueryKey
      })
      toast.success(t('webview.mcp.removedSuccess'))
    },
    onError: error => {
      logAndToastError(t('webview.mcp.failedToRemove'), error)
    }
  })

  const reconnectMutation = useMutation({
    mutationFn: (id: string) => {
      setReconnectingId(id)
      return api.actions().server.mcp.reconnectById({
        actionParams: { id }
      })
    },
    onSuccess: () => {
      setReconnectingId(null)
      invalidateQueries({
        type: 'all-webview',
        queryKeys: mcpConfigsQueryKey
      })
      toast.success(t('webview.mcp.reconnectedSuccess'))
    },
    onError: error => {
      setReconnectingId(null)
      logAndToastError(t('webview.mcp.failedToReconnect'), error)
    }
  })

  const toggleEnabledMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.actions().server.mcp.updateConfig({
        actionParams: { id, isEnabled: enabled }
      }),
    onSuccess: () => {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: mcpConfigsQueryKey
      })
    },
    onError: error => {
      logAndToastError(t('webview.mcp.failedToUpdateConfig'), error)
    }
  })

  const handleSaveConfig = async (values: McpFormValues) => {
    if (editingConfigId) {
      updateConfigMutation.mutate({
        id: editingConfigId,
        ...values
      })
    } else {
      addConfigMutation.mutate(values)
    }
  }

  const handleEditConfig = (configToEdit: McpConfig) => {
    setEditingConfigId(configToEdit.id)
    setConfig(configToEdit)
    setIsDialogOpen(true)
  }

  const handleOpenDialog = () => {
    clearConfigFields()
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    clearConfigFields()
  }

  const handleRemoveConfigs = (items: McpConfig[]) => {
    removeConfigsMutation.mutate(items.map(item => item.id))
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const clearConfigFields = () => {
    setConfig(new McpEntity(t).entity)
    setEditingConfigId(null)
  }

  return (
    <div className="space-y-4">
      <CardList
        items={mcpConfigs}
        idField="id"
        draggable={false}
        minCardWidth={300}
        onCreateItem={handleOpenDialog}
        onDeleteItems={handleRemoveConfigs}
        headerLeftActions={
          <Input
            placeholder={t('webview.mcp.searchPlaceholder')}
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="text-xs h-8"
          />
        }
        renderCard={({ item: config, isSelected, onSelect }) => (
          <McpCard
            config={config}
            onEdit={handleEditConfig}
            onRemove={() => handleRemoveConfigs([config])}
            onReconnect={() => reconnectMutation.mutate(config.id)}
            onToggleEnabled={enabled =>
              toggleEnabledMutation.mutate({ id: config.id, enabled })
            }
            isSelected={isSelected}
            onSelect={onSelect}
            reconnecting={reconnectingId === config.id}
            updating={toggleEnabledMutation.isPending}
          />
        )}
      />

      <McpDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        loading={addConfigMutation.isPending || updateConfigMutation.isPending}
        config={config}
        onSave={handleSaveConfig}
        editMode={Boolean(editingConfigId)}
      />
    </div>
  )
}
