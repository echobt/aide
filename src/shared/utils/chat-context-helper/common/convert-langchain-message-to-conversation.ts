import type { MessageType } from '@langchain/core/messages'
import {
  ConversationEntity,
  type Conversation,
  type ConversationContents,
  type LangchainMessage
} from '@shared/entities'
import { parseAsConversationContents } from '@shared/utils/chat-context-helper/common/parse-as-conversation-contents'

export const convertLangchainMessageToConversation = (
  message: LangchainMessage,
  initConversation?: Partial<Conversation>
): Conversation => {
  const messageType = message.toDict().type as MessageType
  const defaultConversation = new ConversationEntity({
    ...initConversation,
    role: messageType
  }).entity
  const contents: ConversationContents = parseAsConversationContents(
    message.content
  )

  return {
    ...defaultConversation,
    contents
  }
}
