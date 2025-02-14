import { Annotation } from '@langchain/langgraph'

import {
  baseGraphStateConfig,
  type BaseGraphNode,
  type CreateBaseGraphNode
} from '../_base/base-state'
import type { BaseStrategyOptions } from '../_base/base-strategy'

export enum V1GraphNodeName {
  Agent = 'agent',
  Tools = 'tools',
  Generate = 'generate'
}

export const v1GraphState = Annotation.Root({
  ...baseGraphStateConfig,
  shouldContinue: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => true
  })
})

export type V1GraphState = typeof v1GraphState.State

export type V1GraphNode = BaseGraphNode<V1GraphState>

export type CreateV1GraphNode = CreateBaseGraphNode<
  BaseStrategyOptions,
  V1GraphState
>
