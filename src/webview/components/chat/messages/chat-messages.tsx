import React, {
  useEffect,
  useRef,
  type CSSProperties,
  type FC,
  type RefObject
} from 'react'
import type { Conversation } from '@shared/entities'
import { getAllTextFromConversationContents } from '@shared/utils/chat-context-helper/common/get-all-text-from-conversation-contents'
import { AnimatedList } from '@webview/components/ui/animated-list'
import { ScrollArea } from '@webview/components/ui/scroll-area'
import { useChatContext } from '@webview/contexts/chat-context'
import { ConversationContextProvider } from '@webview/contexts/conversation-context'
import { useChatState } from '@webview/hooks/chat/use-chat-state'
import { useWorkspaceCheckpoint } from '@webview/hooks/chat/use-workspace-checkpoint'
import { cn, copyToClipboard } from '@webview/utils/common'
import scrollIntoView from 'scroll-into-view-if-needed'
import type { Updater } from 'use-immer'
import { v4 as uuidv4 } from 'uuid'

import { ChatAIMessage, type ChatAIMessageProps } from './roles/chat-ai-message'
import {
  ChatHumanMessage,
  type ChatHumanMessageProps,
  type ChatHumanMessageRef
} from './roles/chat-human-message'
import {
  MessageToolbar,
  type FreezeType,
  type MessageToolbarEvents
} from './toolbars/message-toolbars'

interface ChatMessagesProps
  extends Pick<
    InnerMessageProps,
    | 'onEditModeChange'
    | 'onSend'
    | 'className'
    | 'style'
    | 'onDelete'
    | 'onRegenerate'
  > {
  autoScrollToBottom?: boolean
  disableAnimation?: boolean
  blankBottomHeight?: number
}

export const ChatMessages: React.FC<ChatMessagesProps> = props => {
  const {
    onSend,
    onEditModeChange,
    className,
    style,
    onDelete,
    onRegenerate,
    autoScrollToBottom = true,
    disableAnimation = false,
    blankBottomHeight = 0
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContentRef = useRef<HTMLDivElement>(null)
  const endOfMessagesRef = useRef<HTMLDivElement>(null)
  const prevConversationIdRef = useRef<string>(undefined)
  const { historiesConversationsWithUIState } = useChatState()
  const lastConversationId = historiesConversationsWithUIState.at(-1)?.id

  useEffect(() => {
    if (!containerRef.current) return

    const currentId = lastConversationId
    const prevId = prevConversationIdRef.current

    if (currentId !== prevId && currentId && autoScrollToBottom) {
      const endOfMessagesElement = endOfMessagesRef.current
      if (endOfMessagesElement) {
        setTimeout(() => {
          scrollIntoView(endOfMessagesElement, {
            scrollMode: 'if-needed',
            block: 'end'
          })
        }, 100)
      }
    }

    prevConversationIdRef.current = lastConversationId
  }, [lastConversationId, autoScrollToBottom])

  return (
    <ScrollArea
      ref={containerRef}
      className={cn(
        'chat-messages flex-1 flex flex-col w-full overflow-y-auto gap-2',
        className
      )}
      viewPortProps={{ ref: scrollContentRef }}
      style={style}
    >
      <style>
        {`
        .chat-messages [data-radix-scroll-area-viewport] > div {
            display:block !important;
            width: 100%;
        }
        `}
      </style>

      {/* Chat messages */}
      <AnimatedList disableAnimation={disableAnimation}>
        {historiesConversationsWithUIState.map(conversationWithUIState => {
          const { uiState, ...conversation } = conversationWithUIState
          return (
            <InnerMessage
              key={conversation.id}
              scrollContentRef={scrollContentRef}
              conversation={conversation}
              onSend={onSend}
              isEditMode={uiState.isEditMode}
              isLoading={uiState.isLoading}
              sendButtonDisabled={uiState.sendButtonDisabled}
              onEditModeChange={onEditModeChange}
              onDelete={onDelete}
              onRegenerate={onRegenerate}
              scrollContentBottomBlankHeight={blankBottomHeight}
            />
          )
        })}
      </AnimatedList>
      <div ref={endOfMessagesRef} className="w-full h-2" />
      <div
        className="w-full"
        style={{ height: `${blankBottomHeight + 184}px` }}
      />
    </ScrollArea>
  )
}

interface InnerMessageProps
  extends Omit<ChatAIMessageProps, 'ref'>,
    Omit<ChatHumanMessageProps, 'ref'>,
    Pick<MessageToolbarEvents, 'onDelete' | 'onRegenerate'> {
  className?: string
  style?: CSSProperties
  scrollContentBottomBlankHeight?: number
  scrollContentRef: RefObject<HTMLElement | null>
  conversation: Conversation
}

const InnerMessage: FC<InnerMessageProps> = props => {
  const messageRef = useRef<ChatHumanMessageRef>(null)
  const {
    conversation,
    onEditModeChange,
    onSend,
    isLoading,
    isEditMode,
    sendButtonDisabled,
    className,
    style,
    scrollContentRef,
    onDelete,
    onRegenerate,
    scrollContentBottomBlankHeight
  } = props

  const { setContext, context, createNewSessionAndSwitch, saveSession } =
    useChatContext()
  const isAiMessage = conversation.role === 'ai'
  const isHumanMessage = conversation.role === 'human'

  const setConversation: Updater<Conversation> = updater => {
    setContext(draft => {
      const index = draft.conversations.findIndex(c => c.id === conversation.id)
      if (index !== -1) {
        if (typeof updater === 'function') {
          updater(draft.conversations[index]!)
        } else {
          draft.conversations[index] = updater
        }
      }
    })
  }

  const handleCopy = () => {
    if (isHumanMessage) {
      messageRef.current?.copy?.()
    }

    if (isAiMessage) {
      copyToClipboard(getAllTextFromConversationContents(conversation.contents))
    }
  }

  const handleFreeze = async (
    conversation: Conversation,
    freezeType: FreezeType
  ) => {
    setContext(draft => {
      const index = draft.conversations.findIndex(c => c.id === conversation.id)

      if (index !== -1) {
        if (freezeType === 'current') {
          draft.conversations[index]!.state.isFreeze = true
        } else {
          // Freeze current and previous messages
          for (let i = 0; i <= index; i++) {
            draft.conversations[i]!.state.isFreeze = true
          }
        }
      }
    })

    await saveSession()
  }

  const handleUnfreeze = async (
    conversation: Conversation,
    unfreezeType: FreezeType
  ) => {
    setContext(draft => {
      const index = draft.conversations.findIndex(c => c.id === conversation.id)

      if (index !== -1) {
        if (unfreezeType === 'current') {
          draft.conversations[index]!.state.isFreeze = false
        } else {
          // Unfreeze current and previous messages
          for (let i = 0; i <= index; i++) {
            draft.conversations[i]!.state.isFreeze = false
          }
        }
      }
    })

    await saveSession()
  }

  const handleCreateNewSession = async (conversation: Conversation) => {
    const index = context.conversations.findIndex(c => c.id === conversation.id)
    if (index === -1) return

    // Get all conversations up to and including the current one
    const conversationsToInclude = context.conversations.slice(0, index + 1)

    // Create new session with this context
    await createNewSessionAndSwitch({
      conversations: conversationsToInclude.map(conversation => ({
        ...conversation,
        id: uuidv4()
      }))
    })
  }

  const { currentWorkspaceCheckpointHash, restoreWorkspaceCheckpoint } =
    useWorkspaceCheckpoint(conversation)

  const handleRestoreCheckpoint = async () => {
    if (!currentWorkspaceCheckpointHash) return
    await restoreWorkspaceCheckpoint()
  }

  const renderMessageToolbar = () => (
    <MessageToolbar
      conversation={conversation}
      scrollContentRef={scrollContentRef}
      messageRef={messageRef}
      onEdit={
        isHumanMessage
          ? () => onEditModeChange?.(true, conversation)
          : undefined
      }
      onCopy={handleCopy}
      onDelete={onDelete}
      onFreeze={handleFreeze}
      onUnfreeze={handleUnfreeze}
      onCreateNewSession={handleCreateNewSession}
      onRestoreCheckpoint={
        currentWorkspaceCheckpointHash ? handleRestoreCheckpoint : undefined
      }
      onRegenerate={isAiMessage ? onRegenerate : undefined}
      scrollContentBottomBlankHeight={scrollContentBottomBlankHeight}
    />
  )

  const messageClassName = cn(
    conversation.state.isFreeze && 'border-primary border-dashed !opacity-50'
  )

  return (
    <ConversationContextProvider
      conversation={conversation}
      setConversation={setConversation}
    >
      <div
        key={conversation.id}
        className={cn(
          'flex flex-col relative max-w-full w-full items-start px-4',
          conversation.role === 'human' && 'items-end',
          className
        )}
        style={style}
      >
        {isAiMessage && (
          <>
            <ChatAIMessage
              ref={messageRef}
              className={messageClassName}
              isLoading={isLoading}
              isEditMode={isEditMode}
              // onEditModeChange={onEditModeChange}
            />
            {renderMessageToolbar()}
          </>
        )}

        {isHumanMessage && (
          <>
            <ChatHumanMessage
              ref={messageRef}
              className={messageClassName}
              onSend={conversation.state.isFreeze ? undefined : onSend}
              isLoading={isLoading}
              isEditMode={isEditMode}
              sendButtonDisabled={sendButtonDisabled}
              onEditModeChange={onEditModeChange}
            />
            {renderMessageToolbar()}
          </>
        )}
      </div>
    </ConversationContextProvider>
  )
}
