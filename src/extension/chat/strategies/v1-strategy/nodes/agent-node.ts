import { ModelProviderFactory } from '@extension/ai/model-providers/helpers/factory'
import { getToolCallsFromMessage } from '@extension/chat/utils/get-tool-calls-from-message'
import { ServerPluginRegister } from '@extension/registers/server-plugin-register'
import type { AIMessageChunk } from '@langchain/core/messages'
import { type LangchainTool } from '@shared/entities'
import { mergeConversationContents } from '@shared/utils/chat-context-helper/common/merge-conversation-contents'
import { parseAsConversationContents } from '@shared/utils/chat-context-helper/common/parse-as-conversation-contents'
import { produce } from 'immer'

import { BaseNode } from '../../_base/base-node'
import { dispatchBaseGraphState } from '../../_base/base-state'
import { V1MessagesConstructor } from '../messages-constructors/v1-messages-constructor'
import { type V1GraphState } from '../state'

export class AgentNode extends BaseNode {
  onInit() {}

  async execute(state: V1GraphState) {
    const modelProvider =
      await ModelProviderFactory.getModelProviderForChatContext(
        state.chatContext
      )
    const aiModel = await modelProvider.createLangChainModel()
    const chatStrategyProvider = this.context.strategyOptions.registerManager
      .getRegister(ServerPluginRegister)
      ?.mentionServerPluginRegistry?.providerManagers.chatStrategy.mergeAll()

    const tools = [
      ...((await chatStrategyProvider?.buildAgentTools?.(
        this.context.strategyOptions,
        state
      )) || [])
    ].filter(Boolean) as LangchainTool[]

    const v1MessagesConstructor = new V1MessagesConstructor({
      ...this.context.strategyOptions,
      chatContext: state.chatContext,
      newConversations: state.newConversations
    })

    const messagesFromChatContext =
      await v1MessagesConstructor.constructMessages()

    const stream = await aiModel
      .bindTools(tools)
      .bind({ signal: state.abortController?.signal })
      .stream(messagesFromChatContext)

    let message: AIMessageChunk | undefined
    let shouldContinue = true
    let { newConversations } = state

    for await (const chunk of stream) {
      if (!message) {
        message = chunk
      } else {
        message = message.concat(chunk)
        // stream with tool calls not need to concat content
        message.content = chunk.content
      }

      const toolCalls = getToolCallsFromMessage(message)
      const contents = parseAsConversationContents(message.content)

      if (!toolCalls.length && contents.length) {
        // no tool calls
        shouldContinue = false
        newConversations = produce(newConversations, draft => {
          draft.at(-1)!.contents = mergeConversationContents([
            ...draft.at(-1)!.contents,
            ...contents
          ])
        })
      }

      if (contents.length) {
        dispatchBaseGraphState({
          newConversations,
          chatContext: state.chatContext
        })
      }
    }

    return {
      shouldContinue,
      newConversations,
      messages: message ? [message] : undefined
    }
  }
}
