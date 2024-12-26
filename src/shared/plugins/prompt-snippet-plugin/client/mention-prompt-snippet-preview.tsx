import { useEffect, useRef } from 'react'
import {
  ChatContextEntity,
  ConversationEntity,
  type PromptSnippet
} from '@shared/entities'
import type { SFC } from '@shared/types/common'
import {
  ChatInput,
  ChatInputMode,
  type ChatInputRef
} from '@webview/components/chat/editor/chat-input'
import { ChatProviders } from '@webview/contexts/providers'
import type { MentionOption } from '@webview/types/chat'
import { useImmer } from 'use-immer'

export const MentionPromptSnippetPreview: SFC<
  MentionOption<PromptSnippet>
> = mentionOption => {
  const promptSnippet = mentionOption.data

  if (!promptSnippet) return null

  return (
    <div className="flex flex-col max-h-[50vh] h-auto overflow-hidden">
      <ChatProviders>
        <PreviewPromptSnippet promptSnippet={promptSnippet} />
      </ChatProviders>
    </div>
  )
}

const PreviewPromptSnippet: React.FC<{ promptSnippet: PromptSnippet }> = ({
  promptSnippet
}) => {
  const chatInputRef = useRef<ChatInputRef>(null)
  const [context, setContext] = useImmer(
    new ChatContextEntity({
      conversations: [
        {
          ...new ConversationEntity().entity,
          ...promptSnippet
        }
      ]
    }).entity
  )
  const conversation = context.conversations[0]!
  const setConversation = (updater: any) => {
    if (typeof updater === 'function') {
      setContext(draft => {
        updater(draft.conversations[0]!)
      })
    } else {
      setContext(draft => {
        draft.conversations[0] = updater
      })
    }
  }

  useEffect(() => {
    // eslint-disable-next-line unused-imports/no-unused-vars
    const { title, createdAt, updatedAt, ...rest } = promptSnippet
    setContext(draft => {
      draft.conversations[0] = {
        ...new ConversationEntity().entity,
        ...rest
      }
    })

    setTimeout(() => {
      chatInputRef.current?.reInitializeEditor()
    }, 0)
  }, [promptSnippet])

  return (
    <ChatInput
      ref={chatInputRef}
      mode={ChatInputMode.MessageReadonly}
      editorClassName="px-2 bg-transparent"
      context={context}
      setContext={setContext}
      conversation={conversation}
      setConversation={setConversation}
      sendButtonDisabled
    />
  )
}
