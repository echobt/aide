import type { CSSProperties, FC, Ref } from 'react'
import { useDeferredValue } from 'react'
import type { Conversation } from '@shared/entities'
import { getAllTextFromConversationContents } from '@shared/utils/chat-context-helper/common/get-all-text-from-conversation-contents'
import {
  ConversationContextProvider,
  useConversationContext
} from '@webview/contexts/conversation-context'
import type { ConversationUIState } from '@webview/types/chat'
import { cn } from '@webview/utils/common'

import { Markdown } from '../markdown'
import { ChatThinks } from './chat-thinks'

export interface ChatAIMessageProps extends ConversationUIState {
  ref?: Ref<HTMLDivElement>
  className?: string
  style?: CSSProperties
  onEditModeChange?: (isEditMode: boolean, conversation: Conversation) => void
}

export const ChatAIMessage: FC<ChatAIMessageProps> = props => {
  const {
    ref,
    isLoading,
    className,
    style,
    isEditMode = false,
    onEditModeChange
  } = props
  const { conversation, setConversation } = useConversationContext()

  // Defer the content updates to avoid blocking the UI
  const deferredContents = useDeferredValue(conversation.contents, [])
  const messageText = getAllTextFromConversationContents(deferredContents)

  return (
    <div ref={ref} className="w-full flex">
      <div
        className={cn(
          'mr-auto relative bg-background text-foreground border overflow-hidden rounded-2xl rounded-bl-[0px]',
          isEditMode && 'w-full',
          className
        )}
        style={style}
        onClick={() => {
          if (isEditMode) return
          onEditModeChange?.(true, conversation)
        }}
      >
        {conversation.thinkAgents.length > 0 && (
          <div className="flex items-center p-2 w-full">
            <ChatThinks conversation={conversation} isLoading={!!isLoading} />
          </div>
        )}
        <ConversationContextProvider
          conversation={conversation}
          setConversation={setConversation}
        >
          <Markdown
            variant="chat"
            className={cn('px-2 min-h-4', !deferredContents && 'opacity-50')}
            isContentGenerating={conversation.state.isGenerating}
          >
            {messageText}
          </Markdown>
        </ConversationContextProvider>
      </div>
    </div>
  )
}
