import { ChatContextType } from '@shared/entities'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@webview/components/ui/select'
import { useChatContext } from '@webview/contexts/chat-context'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

export const getChatTypesConfig = (t: TFunction) =>
  [
    {
      value: ChatContextType.Chat,
      label: 'Chat',
      description: t('webview.chatType.chatDescription')
    },
    {
      value: ChatContextType.Composer,
      label: 'Composer',
      description: t('webview.chatType.composerDescription')
    },
    // TODO: add agent
    // {
    //   value: ChatContextType.Agent,
    //   label: 'Agent',
    //   description: 'Autonomous AI that performs coding tasks with tools'
    // },
    {
      value: ChatContextType.V1,
      label: 'V1',
      description: t('webview.chatType.v1Description')
    },
    {
      value: ChatContextType.NoPrompt,
      label: 'No Prompt',
      description: t('webview.chatType.noPromptDescription')
    }
  ] as const

export const ChatTypeSelector = () => {
  const { t } = useTranslation()
  const { context, setContext } = useChatContext()
  const enabled = context.conversations.length === 0

  const chatTypesConfig = getChatTypesConfig(t)

  const handleContextTypeChange = (value: ChatContextType) => {
    setContext(draft => {
      draft.type = value
    })
  }

  if (!enabled) return null

  const selectedType = chatTypesConfig.find(type => type.value === context.type)

  return (
    <div className="space-y-2">
      <h3 className="font-medium">{t('webview.chatType.title')}</h3>
      <Select value={context.type} onValueChange={handleContextTypeChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('webview.chatType.selectPlaceholder')}>
            {selectedType?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {chatTypesConfig.map(({ value, label, description }) => (
            <SelectItem key={value} value={value}>
              <div className="flex flex-col items-start">
                <div className="font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">
                  {description}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedType && (
        <div className="text-muted-foreground/50 text-sm mt-2">
          {selectedType?.description}
        </div>
      )}
    </div>
  )
}
