import { ChatContextType } from '@shared/entities'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@webview/components/ui/select'
import { useChatContext } from '@webview/contexts/chat-context'

export const CHAT_TYPES = [
  {
    value: ChatContextType.Chat,
    label: 'Chat',
    description: 'Smart code Q&A with context-aware file references'
  },
  {
    value: ChatContextType.Composer,
    label: 'Composer',
    description: 'Write and edit code with AI assistance in your editor'
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
    description: 'Generate modern website code through chat interface'
  }
] as const

export const ChatTypeSelector = () => {
  const { context, setContext } = useChatContext()
  const enabled = context.conversations.length === 0

  const handleContextTypeChange = (value: ChatContextType) => {
    setContext(draft => {
      draft.type = value
    })
  }

  if (!enabled) return null

  const selectedType = CHAT_TYPES.find(type => type.value === context.type)

  return (
    <div className="space-y-2">
      <div className="flex flex-col justify-center gap-2">
        <h3 className="font-medium">Chat Type</h3>
        {selectedType && (
          <span className="text-xs text-muted-foreground">
            {selectedType.description}
          </span>
        )}
      </div>
      <Select value={context.type} onValueChange={handleContextTypeChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a chat type">
            {selectedType?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {CHAT_TYPES.map(({ value, label, description }) => (
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
    </div>
  )
}
