import type { FileInfo } from '@extension/file-utils/traverse-fs'
import type {
  AIMessage,
  ChatMessage,
  FunctionMessage,
  HumanMessage,
  ImageDetail,
  MessageType,
  SystemMessage,
  ToolMessage
} from '@langchain/core/messages'
import type { RunnableToolLike } from '@langchain/core/runnables'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { v4 as uuidv4 } from 'uuid'

import { BaseEntity, type IBaseEntity } from './base-entity'

export interface ImageInfo {
  url: string
  name?: string
}

export interface ConversationState {
  isGenerating: boolean
  isFreeze: boolean
  selectedFilesFromFileSelector: FileInfo[]
  currentFilesFromVSCode: FileInfo[]
  selectedImagesFromOutsideUrl: ImageInfo[]
}

export interface Conversation extends IBaseEntity {
  createdAt: number
  role: MessageType
  contents: ConversationContents
  richText?: string // JSON stringified
  mentions: Mention[]
  thinkAgents: Agent[] // tools calls
  actions: ConversationAction[]
  state: ConversationState
}

export class ConversationEntity extends BaseEntity<Conversation> {
  protected getDefaults(override?: Partial<Conversation>): Conversation {
    return {
      id: uuidv4(),
      createdAt: Date.now(),
      role: 'human',
      contents: [],
      mentions: [],
      thinkAgents: [],
      actions: [],
      state: {
        isGenerating: false,
        isFreeze: false,
        selectedFilesFromFileSelector: [],
        currentFilesFromVSCode: [],
        selectedImagesFromOutsideUrl: []
      },
      ...override
    }
  }
}

export interface Mention<Type extends string = string, Data = any> {
  type: Type
  data: Data
}

export interface Agent<Input = any, Output = any> {
  id: string
  name: string // also is agent plugin id
  input: Input
  output: Output
}

export interface ConversationAction<
  State extends Record<string, any> = Record<string, any>,
  AgentType extends Agent = Agent
> {
  id: string
  state: State
  weight: number
  agent?: AgentType
  workspaceCheckpointHash?: string
}

export type LangchainMessage =
  | HumanMessage
  | SystemMessage
  | AIMessage
  | ChatMessage
  | FunctionMessage
  | ToolMessage

export type ConversationTextContent = {
  type: 'text'
  text: string
}

export type ConversationImageContent = {
  type: 'image_url'
  image_url: {
    url: string
    detail?: ImageDetail
  }
}

export type ConversationActionContent = {
  type: 'action'
  actionId: string
}

export type ConversationContents = (
  | ConversationTextContent
  | ConversationImageContent
  | ConversationActionContent
)[]

export type LangchainTool = StructuredToolInterface | RunnableToolLike
