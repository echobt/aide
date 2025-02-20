import { Anthropic } from '@anthropic-ai/sdk'
import { isOpenAITool } from '@langchain/core/language_models/base'
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  UsageMetadata
} from '@langchain/core/messages'
import type { ToolCallChunk } from '@langchain/core/messages/tool'
import { isLangChainTool } from '@langchain/core/utils/function_calling'
import { hasOwnProperty } from '@shared/utils/common'
import { v4 as uuidv4 } from 'uuid'
import * as vscode from 'vscode'

import type {
  VSCodeAssistantMessageContent,
  VSCodeChatStructuredTool,
  VSCodeMessageContent,
  VSCodeUserMessageContent
} from './types'

export const convertVSCodeOutputChunkMessageToLangChain = (
  messages: vscode.LanguageModelChatMessage,
  extra?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseMetadata?: Record<string, any>
    usageMetadata?: UsageMetadata
  }
): AIMessageChunk => {
  const toolCallParts: vscode.LanguageModelToolCallPart[] = []

  messages.content.forEach(c => {
    if (hasOwnProperty<vscode.LanguageModelToolCallPart>(c, 'callId')) {
      toolCallParts.push(c)
    }
  })

  return new AIMessageChunk({
    content: messages.content ?? '',
    tool_call_chunks: toolCallParts
      .map(tc => ({
        name: tc.name,
        args: JSON.stringify(tc.input),
        type: 'tool_call_chunk',
        index: 0,
        id: tc.callId
      }))
      .filter(Boolean) as ToolCallChunk[],
    response_metadata: extra?.responseMetadata,
    usage_metadata: extra?.usageMetadata
  })
}

const convertAIMessagesToVSCodeMessage = (
  messages: AIMessage
): vscode.LanguageModelChatMessage[] => {
  if (typeof messages.content === 'string') {
    return [
      vscode.LanguageModelChatMessage.Assistant(messages.content, messages.name)
    ]
  }

  const vscodeMessageContents: VSCodeAssistantMessageContent[] = []

  messages.content.forEach(c => {
    if (c.type === 'text' && typeof c.text === 'string') {
      // text content
      vscodeMessageContents.push(new vscode.LanguageModelTextPart(c.text))
    }

    if (c.type === 'tool_use') {
      // tool use

      if (!messages.tool_calls?.length) {
        throw new Error(
          "'tool_use' content type is not supported without tool calls."
        )
      }

      messages.tool_calls.forEach(tc => {
        const callId = tc.id || uuidv4()
        const toolCallPart = new vscode.LanguageModelToolCallPart(
          callId,
          tc.name,
          tc.args
        )
        vscodeMessageContents.push(toolCallPart)
      })
    }
  })

  return [vscode.LanguageModelChatMessage.Assistant(vscodeMessageContents)]
}

const convertHumanGenericMessagesToVSCodeMessage = (
  message: HumanMessage
): vscode.LanguageModelChatMessage[] => {
  if (typeof message.content === 'string') {
    return [vscode.LanguageModelChatMessage.User(message.content)]
  }

  const vscodeMessageContents: VSCodeUserMessageContent[] = []

  message.content.forEach(c => {
    if (c.type === 'text') {
      vscodeMessageContents.push(new vscode.LanguageModelTextPart(c.text))
    }
    if (c.type === 'image_url') {
      if (typeof c.image_url === 'string') {
        // const imgUrl = c.image_url
        // TODO: vscode current not support image
      }
      if (c.image_url.url && typeof c.image_url.url === 'string') {
        // TODO: vscode current not support image
        // const imgUrl = c.image_url.url
      }
    }
    throw new Error(`Unsupported content type: ${c.type}`)
  })

  return [vscode.LanguageModelChatMessage.User(vscodeMessageContents)]
}

const convertSystemMessageToVSCodeMessage = (
  message: SystemMessage
): vscode.LanguageModelChatMessage[] => {
  // TODO: vscode current not support system message, we use the human message to represent the system message
  if (typeof message.content === 'string') {
    return [vscode.LanguageModelChatMessage.User(message.content)]
  }

  let finalContent = ''
  let receivedUnsupportedContent = false
  message.content.forEach(c => {
    if (typeof c === 'string') {
      finalContent += c
    }

    if (c.type === 'text' && typeof c.text === 'string') {
      finalContent += c.text
    }

    if (hasOwnProperty(c, 'type') && c.type && c.type !== 'text') {
      receivedUnsupportedContent = true
    }
  })
  if (receivedUnsupportedContent) {
    throw new Error(
      `Unsupported content type(s): ${message.content
        .map(c => c.type)
        .join(', ')}`
    )
  }
  return [vscode.LanguageModelChatMessage.User(finalContent)]
}

const convertToolMessageToVSCodeMessage = (
  message: ToolMessage
): vscode.LanguageModelChatMessage[] => {
  if (typeof message.content !== 'string') {
    throw new Error('Non string tool message content is not supported')
  }

  const vscodeMessageContents: VSCodeUserMessageContent[] = []

  const id = message.id || uuidv4()
  const toolResultPart = new vscode.LanguageModelToolResultPart(
    id,
    vscodeMessageContents
  )

  vscodeMessageContents.push(toolResultPart)

  return [vscode.LanguageModelChatMessage.User(vscodeMessageContents)]
}

export const convertToVSCodeMessages = (
  messages: BaseMessage[]
): vscode.LanguageModelChatMessage[] =>
  messages.flatMap(msg => {
    if (['human', 'generic'].includes(msg.getType())) {
      return convertHumanGenericMessagesToVSCodeMessage(msg)
    }
    if (msg.getType() === 'ai') {
      return convertAIMessagesToVSCodeMessage(msg)
    }
    if (msg.getType() === 'system') {
      return convertSystemMessageToVSCodeMessage(msg)
    }
    if (msg.getType() === 'tool') {
      return convertToolMessageToVSCodeMessage(msg as ToolMessage)
    }
    throw new Error(`Unsupported message type: ${msg.getType()}`)
  })

export const getTextFromVSCodeMessageContents = (
  contents: VSCodeMessageContent[]
): string => {
  if (!Array.isArray(contents)) {
    throw new Error('Contents must be an array')
  }

  let text = ''
  contents.forEach(c => {
    if (typeof c === 'string') {
      text += c
    }
    if (c instanceof vscode.LanguageModelTextPart) {
      text += c.value
    }
    if (c instanceof vscode.LanguageModelToolResultPart) {
      text += getTextFromVSCodeMessageContents(c.content as any)
    }
  })
  return text
}

const isAnthropicTool = (tool: any): tool is Anthropic.Messages.Tool =>
  'input_schema' in tool

export const formatStructuredToolToVSCodeTool = (
  tools: VSCodeChatStructuredTool[] | undefined
): vscode.LanguageModelChatTool[] | undefined => {
  if (!tools || !tools.length) {
    return undefined
  }

  const vscodeTools: vscode.LanguageModelChatTool[] = []
  const nameVSCodeToolMap: Record<string, vscode.LanguageModelChatTool> = {}
  vscode.lm.tools.forEach(tool => {
    if (tool.tags.includes('aide')) {
      nameVSCodeToolMap[tool.name] = tool
    }
  })

  tools.forEach(tool => {
    let toolName = ''
    if (isAnthropicTool(tool)) {
      toolName = tool.name
    }
    if (isOpenAITool(tool)) {
      toolName = tool.function.name
    }
    if (isLangChainTool(tool)) {
      toolName = tool.name
    }

    const vscodeTool = nameVSCodeToolMap[toolName]

    if (!vscodeTool) {
      throw new Error(
        `Can't find vscode tool for tool: ${JSON.stringify(tool, null, 2)}, vscode don't support dynamic tool registration`
      )
    }

    vscodeTools.push(vscodeTool)
  })

  return vscodeTools
}
