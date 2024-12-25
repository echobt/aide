import { useEffect } from 'react'
import {
  ChatContextEntity,
  ConversationEntity,
  type Conversation,
  type PromptSnippet
} from '@shared/entities'
import type { SFC } from '@shared/types/common'
import {
  ChatInput,
  ChatInputMode
} from '@webview/components/chat/editor/chat-input'
import { ChatProviders } from '@webview/contexts/providers'
import type { MentionOption } from '@webview/types/chat'
import { useImmer, type Updater } from 'use-immer'

export const MentionPromptSnippetPreview: SFC<
  MentionOption<PromptSnippet>
> = mentionOption => {
  const promptSnippet = mentionOption.data

  if (!promptSnippet) return null

  return (
    <div className="flex flex-col h-[50vh] overflow-hidden">
      <ChatProviders>
        <PreviewPromptSnippet promptSnippet={promptSnippet} />
      </ChatProviders>
    </div>
  )
}

const PreviewPromptSnippet: React.FC<{ promptSnippet: PromptSnippet }> = ({
  promptSnippet
}) => {
  const [context, setContext] = useImmer(
    new ChatContextEntity({
      conversations: [new ConversationEntity().entity]
    }).entity
  )

  useEffect(() => {
    // eslint-disable-next-line unused-imports/no-unused-vars
    const { title, ...rest } = promptSnippet
    setContext(draft => {
      draft.conversations[0] = {
        ...new ConversationEntity().entity,
        ...rest
      }
    })
  }, [promptSnippet])

  const conversation = context.conversations[0]!
  const setConversation: Updater<Conversation> = (updater, ...args) => {
    if (typeof updater === 'function') {
      updater(context.conversations[0]!, ...args)
    } else {
      setContext(draft => {
        draft.conversations[0] = updater
      })
    }
  }

  return (
    <ChatInput
      mode={ChatInputMode.MessageReadonly}
      editorClassName="px-2"
      context={context}
      setContext={setContext}
      conversation={conversation}
      setConversation={setConversation}
      sendButtonDisabled
    />
  )
}
