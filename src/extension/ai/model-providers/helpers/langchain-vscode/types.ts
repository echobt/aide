import type { BindToolsInput } from '@langchain/core/language_models/chat_models'
import type { OpenAIChatInput } from '@langchain/openai'
import * as vscode from 'vscode'

export type VSCodeUserMessageContent =
  | vscode.LanguageModelTextPart
  | vscode.LanguageModelToolResultPart

export type VSCodeAssistantMessageContent =
  | vscode.LanguageModelTextPart
  | vscode.LanguageModelToolCallPart

export type VSCodeMessageContent =
  | VSCodeUserMessageContent
  | VSCodeAssistantMessageContent

export interface VSCodeChatModelOptions extends Partial<OpenAIChatInput> {}

export interface VSCodeChatRequestOptions
  extends Omit<vscode.LanguageModelChatRequestOptions, 'modelOptions'> {
  modelOptions?: VSCodeChatModelOptions
}

export type VSCodeChatMessage = vscode.LanguageModelChatMessage

export type VSCodeChatModelClient = vscode.LanguageModelChat
export type VSCodeChatStructuredTool =
  | vscode.LanguageModelChatTool
  | BindToolsInput
