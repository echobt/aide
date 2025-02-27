import { useState } from 'react'
import {
  chatContextTypeModelSettingKeyMap,
  FeatureModelSettingKey,
  type AIProvider
} from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ModelSettingItem } from '@webview/components/settings/custom-renders/ai-provider-management/model-settings'
import { ProviderFormDialog } from '@webview/components/settings/custom-renders/ai-provider-management/provider-form-dialog'
import {
  modelsQueryKey,
  providersQueryKey
} from '@webview/components/settings/custom-renders/ai-provider-management/provider-form/provider-utils'
import { Button } from '@webview/components/ui/button'
import { useChatContext } from '@webview/contexts/chat-context'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export const ModelSettingHint = () => {
  const { t } = useTranslation()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { context } = useChatContext()
  const enabled = context.conversations.length === 0
  const { invalidateQueries } = useInvalidateQueries()
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
      invalidateQueries({
        type: 'all-webview',
        queryKeys: [providersQueryKey]
      })
      invalidateQueries({
        type: 'all-webview',
        queryKeys: [modelsQueryKey]
      })
      toast.success(t('webview.aiModel.providerAddedSuccess'))
      setIsDialogOpen(false)
    },
    onError: error => {
      logAndToastError(t('webview.aiModel.failedToAddProvider'), error)
    }
  })

  const handleSubmit = async (data: Partial<AIProvider>) => {
    await addProviderMutation.mutateAsync(data as Omit<AIProvider, 'id'>)
  }

  const hasDefaultModel = defaultModelInfo?.provider && defaultModelInfo?.model
  const hasContextTypeModel = modelInfo?.provider && modelInfo?.model

  if (!enabled) return null

  if (!providers?.length) {
    return (
      <div className="space-y-2">
        <h3 className="font-medium">{t('webview.aiModel.title')}</h3>
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border p-4">
          <div className="text-muted-foreground text-sm">
            {t('webview.aiModel.configureFirst')}
          </div>
          <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
            {t('webview.aiModel.configureModel')}
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

  if (!hasDefaultModel && !hasContextTypeModel) {
    return (
      <div className="space-y-2">
        <h3 className="font-medium">{t('webview.aiModel.title')}</h3>
        <div className="rounded-md border p-4">
          <div className="text-muted-foreground text-sm mb-2">
            {t('webview.aiModel.chooseDefaultModel')}
          </div>
          <ModelSettingItem settingKey={FeatureModelSettingKey.Default} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="font-medium">{t('webview.aiModel.title')}</h3>
      <ModelSettingItem
        settingKey={chatContextTypeModelSettingKeyMap[context.type]}
      />
      <div className="text-muted-foreground/50 text-sm mt-2">
        {t('webview.aiModel.chooseModelFor', { contextType })}
      </div>
    </div>
  )
}
