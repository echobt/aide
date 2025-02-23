import { Annotation } from '@langchain/langgraph'

import {
  baseGraphStateConfig,
  type BaseGraphNode,
  type CreateBaseGraphNode
} from '../_base/base-state'
import type { BaseStrategyOptions } from '../_base/base-strategy'

export enum NoPromptGraphNodeName {
  Agent = 'agent',
  Tools = 'tools',
  Generate = 'generate'
}

export const noPromptGraphState = Annotation.Root({
  ...baseGraphStateConfig,
  shouldContinue: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => true
  })
})

export type NoPromptGraphState = typeof noPromptGraphState.State

export type NoPromptGraphNode = BaseGraphNode<NoPromptGraphState>

export type CreateNoPromptGraphNode = CreateBaseGraphNode<
  BaseStrategyOptions,
  NoPromptGraphState
>
