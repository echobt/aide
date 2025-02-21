import { useState } from 'react'
import {
  chatContextTypeModelSettingKeyMap,
  FeatureModelSettingKey,
  type AIProvider
} from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ModelSettingItem } from '@webview/components/settings/custom-renders/ai-provider-management/model-settings'
import { ProviderFormDialog } from '@webview/components/settings/custom-renders/ai-provider-management/provider-form-dialog'
import {
  modelsQueryKey,
  providersQueryKey
} from '@webview/components/settings/custom-renders/ai-provider-management/provider-form/provider-utils'
import { Button } from '@webview/components/ui/button'
import { useChatContext } from '@webview/contexts/chat-context'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { toast } from 'sonner'

export const ModelSettingHint = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { context } = useChatContext()
  const enabled = context.conversations.length === 0
  const queryClient = useQueryClient()
  const contextType = context.type
  const contextTypeModelSettingKey =
    chatContextTypeModelSettingKeyMap[contextType]

  const { data: providers } = useQuery({
    queryKey: [providersQueryKey],
    queryFn: ({ signal }) =>
      api.actions().server.aiProvider.getProviders({
        actionParams: {},
        abortController: signalToController(signal)
      }),
    enabled
  })

  const { data: defaultModelInfo } = useQuery({
    queryKey: [modelsQueryKey, FeatureModelSettingKey.Default],
    queryFn: ({ signal }) =>
      api.actions().server.aiModel.getProviderAndModelForFeature({
        actionParams: { key: FeatureModelSettingKey.Default },
        abortController: signalToController(signal)
      }),
    enabled
  })

  const { data: modelInfo } = useQuery({
    queryKey: [modelsQueryKey, contextTypeModelSettingKey],
    queryFn: ({ signal }) =>
      api.actions().server.aiModel.getProviderAndModelForFeature({
        actionParams: { key: contextTypeModelSettingKey },
        abortController: signalToController(signal)
      }),
    enabled
  })

  const addProviderMutation = useMutation({
    mutationFn: (data: Omit<AIProvider, 'id'>) =>
      api.actions().server.aiProvider.addProvider({
        actionParams: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [providersQueryKey] })
      queryClient.invalidateQueries({ queryKey: [modelsQueryKey] })
      toast.success('Provider added successfully')
      setIsDialogOpen(false)
    },
    onError: error => {
      logAndToastError('Failed to add provider', error)
    }
  })

  const handleSubmit = async (data: Partial<AIProvider>) => {
    await addProviderMutation.mutateAsync(data as Omit<AIProvider, 'id'>)
  }

  const hasDefaultModel = defaultModelInfo?.provider && defaultModelInfo?.model
  const hasContextTypeModel = modelInfo?.provider && modelInfo?.model
  const hasModel = hasDefaultModel || hasContextTypeModel

  if (!enabled || hasModel) return null

  if (!providers?.length) {
    return (
      <div className="space-y-2">
        <h3 className="font-medium">AI Model</h3>
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border p-4">
          <div className="text-muted-foreground text-sm">
            Please configure your AI model first
          </div>
          <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
            Configure Model
          </Button>
        </div>

        <ProviderFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSubmit={handleSubmit}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="font-medium">AI Model</h3>
      <div className="rounded-md border p-4">
        <div className="text-muted-foreground text-sm mb-2">
          Please choose a default model
        </div>
        <ModelSettingItem settingKey={FeatureModelSettingKey.Default} />
      </div>
    </div>
  )
}
