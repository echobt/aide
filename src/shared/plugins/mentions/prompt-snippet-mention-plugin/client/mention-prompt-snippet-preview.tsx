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
  type ChatInputEditorRef
} from '@webview/components/chat/editor/chat-input'
import { ConversationContextProvider } from '@webview/contexts/conversation-context'
import { ChatProviders } from '@webview/contexts/providers'
import type { MentionOption } from '@webview/types/chat'
import { useTranslation } from 'react-i18next'
import { useImmer } from 'use-immer'

export const MentionPromptSnippetPreview: SFC<
  MentionOption<PromptSnippet>
> = mentionOption => {
  const promptSnippet = mentionOption.data

  if (!promptSnippet) return null

  return (
    <div className="flex flex-col max-h-[50vh] h-auto overflow-hidden">
      <ChatProviders disableEffect>
        <PreviewPromptSnippet promptSnippet={promptSnippet} />
      </ChatProviders>
    </div>
  )
}

const PreviewPromptSnippet: React.FC<{ promptSnippet: PromptSnippet }> = ({
  promptSnippet
}) => {
  const { t } = useTranslation()
  const editorRef = useRef<ChatInputEditorRef>(null)
  const [context, setContext] = useImmer(
    new ChatContextEntity(t, {
      conversations: [
        {
          ...new ConversationEntity(t).entity,
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
        ...new ConversationEntity(t).entity,
        ...rest
      }
    })

    setTimeout(() => {
      editorRef.current?.reInitializeEditor()
    }, 0)
  }, [promptSnippet])

  return (
    <ChatProviders
      disableEffect
      chatStoreOverrides={{
        context,
        setContext
      }}
    >
      <ConversationContextProvider
        conversation={conversation}
        setConversation={setConversation}
      >
        <ChatInput
          editorRef={editorRef}
          mode={ChatInputMode.MessageReadonly}
          editorClassName="px-2 bg-transparent"
          sendButtonDisabled
        />
      </ConversationContextProvider>
    </ChatProviders>
  )
}
