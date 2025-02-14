import { ModelProviderFactory } from '@extension/ai/model-providers/helpers/factory'
import type { AIMessageChunk } from '@langchain/core/messages'
import { mergeConversationContents } from '@shared/utils/chat-context-helper/common/merge-conversation-contents'
import { parseAsConversationContents } from '@shared/utils/chat-context-helper/common/parse-as-conversation-contents'
import { produce } from 'immer'

import { BaseNode } from '../../_base/base-node'
import { dispatchBaseGraphState } from '../../_base/base-state'
import { V1MessagesConstructor } from '../messages-constructors/v1-messages-constructor'
import { type V1GraphState } from '../state'

export class GenerateNode extends BaseNode {
  onInit() {}

  async execute(state: V1GraphState) {
    const modelProvider =
      await ModelProviderFactory.getModelProviderForChatContext(
        state.chatContext
      )
    const aiModel = await modelProvider.createLangChainModel()

    const v1MessagesConstructor = new V1MessagesConstructor({
      ...this.context.strategyOptions,
      chatContext: state.chatContext
    })

    const messagesFromChatContext =
      await v1MessagesConstructor.constructMessages()

    const stream = await aiModel
      .bind({ signal: state.abortController?.signal })
      .stream(messagesFromChatContext)

    let message: AIMessageChunk | undefined
    let { newConversations } = state

    for await (const chunk of stream) {
      if (!message) {
        message = chunk
      } else {
        message = message.concat(chunk)
      }

      const contents = parseAsConversationContents(message.content)

      if (contents.length) {
        newConversations = produce(state.newConversations, draft => {
          draft.at(-1)!.contents = mergeConversationContents([
            ...draft.at(-1)!.contents,
            ...contents
          ])
        })
      }

      dispatchBaseGraphState({
        newConversations,
        chatContext: state.chatContext
      })
    }

    return {
      messages: message ? [message] : undefined,
      newConversations
    }
  }
}
