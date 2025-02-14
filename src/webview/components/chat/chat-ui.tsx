import { useRef, type FC } from 'react'
import { GearIcon, MagnifyingGlassIcon, PlusIcon } from '@radix-ui/react-icons'
import { ChatContextType, type Conversation } from '@shared/entities'
import { isAbortError } from '@shared/utils/common'
import { useChatContext } from '@webview/contexts/chat-context'
import { ConversationContextProvider } from '@webview/contexts/conversation-context'
import { useGlobalSearch } from '@webview/contexts/global-search-context'
import { useChatState } from '@webview/hooks/chat/use-chat-state'
import { useSendMessage } from '@webview/hooks/chat/use-send-message'
import { useElementSize } from '@webview/hooks/use-element-size'
import { logger } from '@webview/utils/logger'
import { Globe } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useKey } from 'react-use'

import { ButtonWithTooltip } from '../button-with-tooltip'
import { BorderBeam } from '../ui/border-beam'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { SidebarLayout } from '../ui/sidebar/sidebar-layout'
import { ChatInput, type ChatInputEditorRef } from './editor/chat-input'
import { ChatMessages } from './messages/chat-messages'
import { ChatSidebar } from './sidebar/chat-sidebar'
import { ChatWebPreviewProvider } from './web-preview/chat-web-preview-context'
import { ChatWebPreviewPopover } from './web-preview/chat-web-preview-popover'

const CHAT_TYPES = [
  { value: ChatContextType.Chat, label: 'Chat' },
  { value: ChatContextType.Composer, label: 'Composer' },
  { value: ChatContextType.Agent, label: 'Agent' },
  { value: ChatContextType.V1, label: 'V1' }
] as const

const InnerChatUI: FC = () => {
  const navigate = useNavigate()
  const {
    context,
    getContext,
    setContext,
    saveSession,
    createNewSessionAndSwitch,
    isSending
  } = useChatContext()
  const {
    newConversation,
    setNewConversation,
    deleteConversation,
    newConversationUIState,
    toggleConversationEditMode
  } = useChatState()
  const editorRef = useRef<ChatInputEditorRef>(null)
  const editorWrapperRef = useRef<HTMLDivElement>(null)
  const editorWrapperSize = useElementSize(editorWrapperRef)
  const { openSearch } = useGlobalSearch()
  const { sendMessage, cancelSending } = useSendMessage()
  const showActionCollapsible = [
    ChatContextType.Composer,
    ChatContextType.Agent
  ].includes(context.type)

  useKey(
    event => (event.metaKey || event.ctrlKey) && event.key === 'Delete',
    () => {
      if (isSending) {
        cancelSending()
      }
    },
    { event: 'keydown' }
  )

  const handleSend = async (conversation: Conversation) => {
    try {
      await sendMessage(conversation)
      editorRef.current?.clearInput()
      editorRef.current?.reInitializeEditor()
      editorRef.current?.focusOnEditor()
    } catch (error) {
      if (isAbortError(error)) return
      logger.error('Failed to send message:', error)
    }
  }

  const handleEditModeChange = (
    isEditMode: boolean,
    conversation: Conversation
  ) => {
    toggleConversationEditMode(conversation.id, isEditMode)
  }

  const handleDelete = (conversation: Conversation) => {
    // 1. stop generate
    // 2. delete conversation
    cancelSending()
    deleteConversation(conversation.id)
  }

  const handleRegenerate = async (conversation: Conversation) => {
    if (conversation.role !== 'ai') return
    cancelSending()
    const context = getContext()

    // find the previous conversation
    const currentConversationIndex = context.conversations.findIndex(
      c => c.id === conversation.id
    )
    const previousConversation =
      context.conversations[currentConversationIndex - 1]
    if (!previousConversation) return

    await handleSend(previousConversation)
  }

  const handleContextTypeChange = async (value: string) => {
    setContext(draft => {
      draft.type = value as ChatContextType
    })
    await saveSession()
  }

  return (
    <SidebarLayout
      title=""
      leftSidebar={<ChatSidebar />}
      headerLeft={
        <>
          <ButtonWithTooltip
            variant="ghost"
            size="iconXs"
            tooltip="Search"
            side="bottom"
            className="shrink-0"
            onClick={openSearch}
          >
            <MagnifyingGlassIcon className="size-3" />
          </ButtonWithTooltip>
          <ButtonWithTooltip
            variant="ghost"
            size="iconXs"
            tooltip="New Chat"
            side="bottom"
            className="shrink-0"
            onClick={() => createNewSessionAndSwitch()}
          >
            <PlusIcon className="size-3" />
          </ButtonWithTooltip>
          <ButtonWithTooltip
            variant="ghost"
            size="iconXs"
            tooltip="Settings"
            side="bottom"
            className="shrink-0"
            onClick={() => {
              navigate('/settings')
            }}
          >
            <GearIcon className="size-3" />
          </ButtonWithTooltip>
        </>
      }
      headerRight={
        <>
          {/* for v1 */}
          <ChatWebPreviewPopover>
            <ButtonWithTooltip
              variant="ghost"
              size="iconXs"
              tooltip="UI Preview"
              side="bottom"
              className="shrink-0 mr-1"
            >
              <Globe className="size-3" />
            </ButtonWithTooltip>
          </ChatWebPreviewPopover>

          <Select value={context.type} onValueChange={handleContextTypeChange}>
            <SelectTrigger className="h-6 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHAT_TYPES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      className="chat-ui"
    >
      <div className="relative w-full h-full overflow-hidden flex flex-col">
        <ChatMessages
          onSend={handleSend}
          onEditModeChange={handleEditModeChange}
          onDelete={handleDelete}
          onRegenerate={handleRegenerate}
          blankBottomHeight={
            editorWrapperSize.height + (showActionCollapsible ? 28 : 0)
          }
        />
        {isSending && (
          <div className="absolute left-1/2 bottom-[260px] -translate-x-1/2 z-[1]">
            <ButtonWithTooltip
              variant="secondary"
              size="sm"
              tooltip="Cancel the message generation or pressing ⌘⌫"
              onClick={cancelSending}
              className="bg-secondary/50"
            >
              ⌘⌫ Cancel
              <BorderBeam size={50} duration={2} delay={0.5} />
            </ButtonWithTooltip>
          </div>
        )}

        <ConversationContextProvider
          conversation={newConversation}
          setConversation={setNewConversation}
        >
          <ChatInput
            editorWrapperRef={editorWrapperRef}
            editorRef={editorRef}
            className="absolute bottom-0 left-0 right-0 z-[1] "
            showActionCollapsible={showActionCollapsible}
            autoFocus
            editorWrapperClassName="shrink-0 rounded-tl-xl rounded-tr-xl bg-background"
            borderAnimation={newConversationUIState.isLoading}
            sendButtonDisabled={
              newConversationUIState.isLoading ??
              newConversationUIState.sendButtonDisabled ??
              false
            }
            isSending={isSending}
            onSend={handleSend}
          />
        </ConversationContextProvider>
      </div>
    </SidebarLayout>
  )
}

export const ChatUI = () => (
  <ChatWebPreviewProvider value={{}}>
    <InnerChatUI />
  </ChatWebPreviewProvider>
)
