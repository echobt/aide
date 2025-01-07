import type { CSSProperties, FC, Ref } from 'react'
import type { Conversation } from '@shared/entities'
import { getAllTextFromConversationContents } from '@shared/utils/chat-context-helper/common/get-all-text-from-conversation-contents'
import { MarkdownActionContextProvider } from '@webview/contexts/conversation-action-context/markdown-action-context'
import type { ConversationUIState } from '@webview/types/chat'
import { cn } from '@webview/utils/common'
import type { Updater } from 'use-immer'

import { Markdown } from '../markdown'
import { ChatThinks } from './chat-thinks'

export interface ChatAIMessageProps extends ConversationUIState {
  ref?: Ref<HTMLDivElement>
  className?: string
  style?: CSSProperties
  conversation: Conversation
  setConversation: Updater<Conversation>
  onEditModeChange?: (isEditMode: boolean, conversation: Conversation) => void
}

export const ChatAIMessage: FC<ChatAIMessageProps> = props => {
  const {
    ref,
    conversation,
    isLoading,
    className,
    style,
    isEditMode = false,
    setConversation,
    onEditModeChange
  } = props

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
        <MarkdownActionContextProvider
          conversation={conversation}
          setConversation={setConversation}
        >
          <Markdown
            variant="chat"
            className={cn('px-2', !conversation.contents && 'opacity-50')}
            enableActionController
          >
            {getAllTextFromConversationContents(conversation.contents)}
          </Markdown>
        </MarkdownActionContextProvider>
      </div>
    </div>
  )
}
