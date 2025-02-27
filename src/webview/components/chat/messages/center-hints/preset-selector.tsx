import { ChatContextType } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@webview/components/ui/select'
import { useChatContext } from '@webview/contexts/chat-context'
import { useLastDefaultV1PresetName } from '@webview/hooks/chat/use-storage-vars'
import { api } from '@webview/network/actions-api'
import { useTranslation } from 'react-i18next'

export const PresetSelector = () => {
  const { t } = useTranslation()
  const { context, setContext } = useChatContext()
  const defaultPresetName = context.settings.defaultV1PresetName
  const enabled =
    context.type === ChatContextType.V1 && context.conversations.length === 0

  const { data: presetsInfo } = useQuery({
    queryKey: ['web-preview-presets-info'],
    queryFn: ({ signal }) =>
      api.actions().server.webvm.getPresetsInfo({
        actionParams: {},
        abortController: signalToController(signal)
      }),
    enabled
  })

  const [, setLastDefaultV1PresetName] = useLastDefaultV1PresetName()

  const handleChangePreset = (presetName: string) => {
    setContext(draft => {
      draft.settings.defaultV1PresetName = presetName
    })
    setLastDefaultV1PresetName(presetName)
  }

  if (!enabled) return null

  return (
    <div className="space-y-2">
      <h3 className="font-medium">{t('webview.preset.title')}</h3>
      <div className="flex flex-col items-center justify-center gap-2">
        <Select value={defaultPresetName} onValueChange={handleChangePreset}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('webview.preset.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {presetsInfo?.map(preset => (
              <SelectItem key={preset.presetName} value={preset.presetName}>
                {preset.presetName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
