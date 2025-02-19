import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import type { BaseStrategyOptions } from '@extension/chat/strategies/_base/base-strategy'
import { DynamicStructuredTool } from '@langchain/core/tools'
import type { Agent } from '@shared/entities'
import type { MaybePromise } from '@shared/types/common'
import { z } from 'zod'

export interface AgentContext<
  State extends BaseGraphState = BaseGraphState,
  CreateToolOptions extends Record<string, any> = Record<string, any>,
  StrategyOptions extends BaseStrategyOptions = BaseStrategyOptions
> {
  state: State
  createToolOptions: CreateToolOptions
  strategyOptions: StrategyOptions
}

export abstract class BaseAgent<
  State extends BaseGraphState = BaseGraphState,
  CreateToolOptions extends Record<string, any> = Record<string, any>,
  StrategyOptions extends BaseStrategyOptions = BaseStrategyOptions,
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType
> {
  abstract inputSchema: TInput | (() => MaybePromise<TInput>)

  abstract outputSchema: TOutput | (() => MaybePromise<TOutput>)

  abstract name: string

  abstract description: string

  constructor(
    public context: AgentContext<State, CreateToolOptions, StrategyOptions>
  ) {}

  // Abstract method that needs to be implemented by concrete agents
  abstract execute(input: z.infer<TInput>): Promise<z.infer<TOutput>>

  // Create the Langchain tool
  async createTool(): Promise<DynamicStructuredTool | null> {
    const inputSchema =
      typeof this.inputSchema === 'function'
        ? await this.inputSchema()
        : this.inputSchema

    const outputSchema =
      typeof this.outputSchema === 'function'
        ? await this.outputSchema()
        : this.outputSchema

    return new DynamicStructuredTool({
      name: this.name,
      description: this.description,
      schema: inputSchema as any,
      func: async (input: z.infer<TInput>) => {
        const result = await this.execute(input)
        return outputSchema.parse(result)
      }
    })
  }
}

type InferZodTypeFromAgentIO<
  T extends z.ZodType | (() => MaybePromise<z.ZodType>)
> = T extends z.ZodType
  ? z.infer<T>
  : T extends () => MaybePromise<z.ZodType>
    ? z.infer<Awaited<ReturnType<T>>>
    : never

export type GetAgentInput<T extends BaseAgent> = InferZodTypeFromAgentIO<
  T['inputSchema']
>

export type GetAgentOutput<T extends BaseAgent> = InferZodTypeFromAgentIO<
  T['outputSchema']
>

export type GetAgent<T extends BaseAgent> = Agent<
  GetAgentInput<T>,
  GetAgentOutput<T>
>
