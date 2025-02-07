import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@webview/components/ui/alert-dialog'
import { BorderBeam } from '@webview/components/ui/border-beam'
import {
  ConversationContextProvider,
  useConversationContext
} from '@webview/contexts/conversation-context'
import { useConversation } from '@webview/hooks/chat/use-conversation'
import { useWorkspaceCheckpoint } from '@webview/hooks/chat/use-workspace-checkpoint'
import type { ConversationUIState } from '@webview/types/chat'
import { cn } from '@webview/utils/common'
import { motion } from 'framer-motion'

export interface ChatHumanMessageRef extends HTMLDivElement {
  copy?: () => void
}

export interface ChatHumanMessageProps
  extends Pick<ChatInputProps, 'onSend'>,
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
    onSend,
    className,
    style
  } = props

  const { conversation: initialConversation } = useConversationContext()
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

  const [showRestoreAlert, setShowRestoreAlert] = useState(false)
  const [pendingConversation, setPendingConversation] =
    useState<Conversation | null>(null)

  useEffect(() => {
    if (isEditMode) {
      // i don't know why this is needed
      setTimeout(() => {
        editorRef.current?.focusOnEditor(true)
      }, 0)
    }
  }, [isEditMode])

  const { currentWorkspaceCheckpointHash, restoreWorkspaceCheckpoint } =
    useWorkspaceCheckpoint(conversation)

  const handleSend = async (conversation: Conversation) => {
    if (currentWorkspaceCheckpointHash) {
      setShowRestoreAlert(true)
      setPendingConversation(conversation)
      return
    }

    onSend?.(conversation)
  }

  const handleConfirmRestore = async () => {
    if (!pendingConversation) return

    if (currentWorkspaceCheckpointHash) {
      await restoreWorkspaceCheckpoint()
    }

    setShowRestoreAlert(false)
    setPendingConversation(null)
    onSend?.(pendingConversation)
  }

  const handleCancelRestore = () => {
    if (!pendingConversation) return

    setShowRestoreAlert(false)
    setPendingConversation(null)
    onSend?.(pendingConversation)
  }

  return (
    <>
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
            <ConversationContextProvider
              conversation={conversation}
              setConversation={setConversation}
            >
              <ChatInput
                editorRef={editorRef}
                mode={
                  isEditMode
                    ? ChatInputMode.MessageEdit
                    : ChatInputMode.MessageReadonly
                }
                editorClassName="px-2"
                sendButtonDisabled={isLoading ?? sendButtonDisabled ?? false}
                onSend={handleSend}
                onExitEditMode={() => {
                  onEditModeChange?.(false, conversation)
                }}
              />
            </ConversationContextProvider>
          </motion.div>
          {isLoading && <BorderBeam size={200} duration={2} delay={0.5} />}
        </motion.div>
      </div>

      <AlertDialog open={showRestoreAlert} onOpenChange={setShowRestoreAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Checkpoint</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to restore the workspace checkpoint before sending the
              message?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelRestore}>
              No, Send Without Restore
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore}>
              Yes, Restore and Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
