import { Annotation } from '@langchain/langgraph'

import {
  baseGraphStateConfig,
  type BaseGraphNode,
  type CreateBaseGraphNode
} from '../_base/base-state'
import type { BaseStrategyOptions } from '../_base/base-strategy'

export enum ComposerGraphNodeName {
  Agent = 'agent',
  Tools = 'tools',
  Generate = 'generate'
}

export const composerGraphState = Annotation.Root({
  ...baseGraphStateConfig,
  shouldContinue: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => true
  })
})

export type ComposerGraphState = typeof composerGraphState.State

export type ComposerGraphNode = BaseGraphNode<ComposerGraphState>

export type CreateComposerGraphNode = CreateBaseGraphNode<
  BaseStrategyOptions,
  ComposerGraphState
>
