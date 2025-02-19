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
import { api } from '@webview/network/actions-api'

import { useChatWebPreviewContext } from '../../web-preview/chat-web-preview-context'

export const PresetSelector = () => {
  const { context } = useChatContext()
  const enabled =
    context.type === ChatContextType.V1 && context.conversations.length === 0
  const { defaultPresetName, setDefaultPresetName } = useChatWebPreviewContext()

  const { data: presetsInfo } = useQuery({
    queryKey: ['web-preview-presets-info'],
    queryFn: ({ signal }) =>
      api.actions().server.webvm.getPresetsInfo({
        actionParams: {},
        abortController: signalToController(signal)
      }),
    enabled
  })

  if (!enabled) return null

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="text-muted-foreground text-sm">
        Select a preset to start
      </div>
      <Select value={defaultPresetName} onValueChange={setDefaultPresetName}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select preset" />
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
  )
}
