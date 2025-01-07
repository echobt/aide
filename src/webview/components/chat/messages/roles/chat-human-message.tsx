import {
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type FC,
  type Ref
} from 'react'
import type { Conversation } from '@shared/entities'
import {
  ChatInput,
  ChatInputMode,
  type ChatInputEditorRef,
  type ChatInputProps
} from '@webview/components/chat/editor/chat-input'
import { BorderBeam } from '@webview/components/ui/border-beam'
import { useChatContext } from '@webview/contexts/chat-context'
import { useConversation } from '@webview/hooks/chat/use-conversation'
import type { ConversationUIState } from '@webview/types/chat'
import { cn } from '@webview/utils/common'
import { motion } from 'framer-motion'

export interface ChatHumanMessageRef extends HTMLDivElement {
  copy?: () => void
}

export interface ChatHumanMessageProps
  extends Pick<ChatInputProps, 'conversation' | 'onSend'>,
    ConversationUIState {
  ref?: Ref<ChatHumanMessageRef>
  className?: string
  style?: CSSProperties
  onEditModeChange?: (isEditMode: boolean, conversation: Conversation) => void
}

export const ChatHumanMessage: FC<ChatHumanMessageProps> = props => {
  const {
    ref,
    isLoading,
    isEditMode = false,
    sendButtonDisabled,
    onEditModeChange,
    conversation: initialConversation,
    onSend,
    className,
    style
  } = props

  const { context, setContext } = useChatContext()
  const editorRef = useRef<ChatInputEditorRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () =>
    Object.assign(containerRef.current!, {
      copy: () => editorRef.current?.copyWithFormatting()
    })
  )

  const { conversation, setConversation } = useConversation(
    'human',
    initialConversation
  )

  useEffect(() => {
    if (isEditMode) {
      // i don't know why this is needed
      setTimeout(() => {
        editorRef.current?.focusOnEditor(true)
      }, 0)
    }
  }, [isEditMode])

  return (
    <div ref={containerRef} className="w-full flex">
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        layoutId={`human-message-${conversation.id}`}
        transition={{
          layout: { duration: 0.3, ease: 'easeInOut' },
          opacity: { duration: 0.2 }
        }}
        className={cn(
          'relative ml-auto bg-background text-foreground border rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl overflow-hidden',
          isEditMode && 'w-full',
          className
        )}
        style={{ ...style, willChange: 'auto' }}
        onClick={() => {
          if (isEditMode) return
          onEditModeChange?.(true, conversation)
        }}
      >
        <motion.div
          layout="preserve-aspect"
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{ willChange: 'auto' }}
        >
          <ChatInput
            editorRef={editorRef}
            mode={
              isEditMode
                ? ChatInputMode.MessageEdit
                : ChatInputMode.MessageReadonly
            }
            editorClassName="px-2"
            context={context}
            setContext={setContext}
            conversation={conversation}
            setConversation={setConversation}
            sendButtonDisabled={isLoading ?? sendButtonDisabled ?? false}
            onSend={onSend}
            onExitEditMode={() => {
              onEditModeChange?.(false, conversation)
            }}
          />
        </motion.div>
        {isLoading && <BorderBeam size={200} duration={2} delay={0.5} />}
      </motion.div>
    </div>
  )
}
