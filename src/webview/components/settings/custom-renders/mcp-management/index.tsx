import { useState } from 'react'
import { MCPEntity, type MCPConfig } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CardList } from '@webview/components/ui/card-list'
import { Input } from '@webview/components/ui/input'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { toast } from 'sonner'
import { useImmer } from 'use-immer'

import { MCPCard } from './mcp-card'
import { MCPDialog, type MCPFormValues } from './mcp-dialog'

// Query key for MCP configs
const mcpConfigsQueryKey = ['mcpConfigs'] as const

export const MCPManagement = () => {
  const queryClient = useQueryClient()
  const [config, setConfig] = useImmer<Partial<MCPConfig>>(
    new MCPEntity().entity
  )
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

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
    mutationFn: (data: MCPFormValues) =>
      api.actions().server.mcp.addConfig({
        actionParams: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpConfigsQueryKey })
      toast.success('New MCP configuration added successfully')
      handleCloseDialog()
    },
    onError: error => {
      logAndToastError('Failed to add MCP configuration', error)
    }
  })

  const updateConfigMutation = useMutation({
    mutationFn: (data: MCPFormValues & { id: string }) =>
      api.actions().server.mcp.updateConfig({
        actionParams: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpConfigsQueryKey })
      toast.success('MCP configuration updated successfully')
      handleCloseDialog()
    },
    onError: error => {
      logAndToastError('Failed to update MCP configuration', error)
    }
  })

  const removeConfigsMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.actions().server.mcp.removeConfigs({
        actionParams: { ids }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpConfigsQueryKey })
      toast.success('MCP configuration removed successfully')
    },
    onError: error => {
      logAndToastError('Failed to remove MCP configuration', error)
    }
  })

  const reconnectMutation = useMutation({
    mutationFn: (id: string) =>
      api.actions().server.mcp.reconnectById({
        actionParams: { id }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpConfigsQueryKey })
      toast.success('Reconnected successfully')
    },
    onError: error => {
      logAndToastError('Failed to reconnect', error)
    }
  })

  const toggleEnabledMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.actions().server.mcp.updateConfig({
        actionParams: { id, isEnabled: enabled }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpConfigsQueryKey })
    },
    onError: error => {
      logAndToastError('Failed to update configuration', error)
    }
  })

  const handleSaveConfig = async (values: MCPFormValues) => {
    if (editingConfigId) {
      updateConfigMutation.mutate({
        id: editingConfigId,
        ...values
      })
    } else {
      addConfigMutation.mutate(values)
    }
  }

  const handleEditConfig = (configToEdit: MCPConfig) => {
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

  const handleRemoveConfigs = (items: MCPConfig[]) => {
    removeConfigsMutation.mutate(items.map(item => item.id))
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const clearConfigFields = () => {
    setConfig(new MCPEntity().entity)
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
            placeholder="Search MCP configurations..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="text-xs h-8"
          />
        }
        renderCard={({ item: config, isSelected, onSelect }) => (
          <MCPCard
            config={config}
            onEdit={handleEditConfig}
            onRemove={() => handleRemoveConfigs([config])}
            onReconnect={() => reconnectMutation.mutate(config.id)}
            onToggleEnabled={enabled =>
              toggleEnabledMutation.mutate({ id: config.id, enabled })
            }
            isSelected={isSelected}
            onSelect={onSelect}
            reconnecting={reconnectMutation.isPending}
            updating={toggleEnabledMutation.isPending}
          />
        )}
      />

      <MCPDialog
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
