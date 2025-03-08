import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager'
import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions
} from '@langchain/core/language_models/base'
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  BindToolsInput,
  LangSmithParams,
  type BaseChatModelParams
} from '@langchain/core/language_models/chat_models'
import {
  AIMessage,
  AIMessageChunk,
  UsageMetadata,
  type BaseMessage
} from '@langchain/core/messages'
import {
  JsonOutputParser,
  StructuredOutputParser
} from '@langchain/core/output_parsers'
import { ChatGenerationChunk, ChatResult } from '@langchain/core/outputs'
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence
} from '@langchain/core/runnables'
import { concat } from '@langchain/core/utils/stream'
import { isZodSchema } from '@langchain/core/utils/types'
import * as vscode from 'vscode'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import {
  VSCodeChatModelOptions,
  type VSCodeAssistantMessageContent,
  type VSCodeChatMessage,
  type VSCodeChatModelClient,
  type VSCodeChatRequestOptions,
  type VSCodeChatStructuredTool
} from './types'
import {
  convertToVSCodeMessages,
  convertVSCodeOutputChunkMessageToLangChain,
  formatStructuredToolToVSCodeTool,
  getTextFromVSCodeMessageContents
} from './utils'

export interface ChatVSCodeCallOptions extends BaseChatModelCallOptions {
  maxTokens?: number
  temperature?: number
  tools?: VSCodeChatStructuredTool[]
  format?: string | Record<string, any>
}

/**
 * Input to chat model class.
 */
export interface ChatVSCodeInput extends BaseChatModelParams {
  /**
   * The model to invoke. If the model does not exist, it
   * will be pulled.
   * @default "claude-3-5-sonnet-20241022"
   */
  model: string

  modelOptions?: VSCodeChatModelOptions

  justification?: string

  streaming?: boolean

  temperature?: number

  maxTokens?: number

  vendor?: string

  format?: string | Record<string, any>
}

export class ChatVSCode
  extends BaseChatModel<ChatVSCodeCallOptions, AIMessageChunk>
  implements ChatVSCodeInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return 'ChatVSCode'
  }

  model = 'claude-3-5-sonnet-20241022'

  // vendor = 'copilot'
  vendor?: string

  justification = 'VSCode AI Langchain Wrapper by AIDE'

  modelOptions?: VSCodeChatModelOptions

  streaming: boolean

  format?: string | Record<string, any>

  modelClient?: VSCodeChatModelClient

  temperature?: number

  maxTokens?: number

  constructor(fields?: ChatVSCodeInput) {
    super(fields ?? {})

    this.model = fields?.model ?? this.model
    this.modelOptions = fields?.modelOptions
    this.vendor = fields?.vendor ?? this.vendor
    this.justification = fields?.justification ?? this.justification
    this.format = fields?.format
    this.streaming = fields?.streaming ?? false
    this.temperature = fields?.temperature ?? this.temperature
    this.maxTokens = fields?.maxTokens ?? this.maxTokens
  }

  // Replace
  _llmType() {
    return 'vscode'
  }

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<this['ParsedCallOptions']>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, ChatVSCodeCallOptions> {
    return this.bind({
      tools: formatStructuredToolToVSCodeTool(tools),
      ...kwargs
    })
  }

  async getOrCreateModelClient() {
    if (!this.modelClient) {
      const [model] = await vscode.lm.selectChatModels(
        !this.vendor && !this.model
          ? undefined
          : {
              vendor: this.vendor,
              family: this.model
            }
      )

      if (!model) throw new Error('No model found')

      this.modelClient = model
    }
    return this.modelClient
  }

  getLsParams(options: this['ParsedCallOptions']): LangSmithParams {
    const params = this.invocationParams(options)
    return {
      ls_provider: 'vscode',
      ls_model_name: this.model,
      ls_model_type: 'chat',
      ls_temperature: params.modelOptions?.temperature ?? undefined,
      ls_max_tokens: params.modelOptions?.maxTokens ?? undefined,
      ls_stop: options.stop
    }
  }

  invocationParams(
    options?: this['ParsedCallOptions']
  ): VSCodeChatRequestOptions {
    const format = options?.format ?? this.format

    return {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      format,
      justification: this.justification,
      toolMode:
        options?.tool_choice === 'any'
          ? vscode.LanguageModelChatToolMode.Required
          : vscode.LanguageModelChatToolMode.Auto,
      modelOptions: {
        ...this.modelOptions,
        temperature: this.temperature || this.modelOptions?.temperature,
        maxTokens: this.maxTokens || this.modelOptions?.maxTokens
      },
      tools: formatStructuredToolToVSCodeTool(options?.tools)
    }
  }

  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    let finalChunk: AIMessageChunk | undefined
    for await (const chunk of this._streamResponseChunks(
      messages,
      options,
      runManager
    )) {
      if (!finalChunk) {
        finalChunk = chunk.message
      } else {
        finalChunk = concat(finalChunk, chunk.message)
      }
    }

    // Convert from AIMessageChunk to AIMessage since `generate` expects AIMessage.
    const nonChunkMessage = new AIMessage({
      id: finalChunk?.id,
      content: finalChunk?.content ?? '',
      tool_calls: finalChunk?.tool_calls,
      response_metadata: finalChunk?.response_metadata,
      usage_metadata: finalChunk?.usage_metadata
    })
    return {
      generations: [
        {
          text:
            typeof nonChunkMessage.content === 'string'
              ? nonChunkMessage.content
              : '',
          message: nonChunkMessage
        }
      ]
    }
  }

  /**
   * Implement to support streaming.
   * Should yield chunks iteratively.
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.invocationParams(options)
    // TODO: remove cast after SDK adds support for tool calls
    const vscodeMessages = convertToVSCodeMessages(
      messages
    ) as VSCodeChatMessage[]

    const usageMetadata: UsageMetadata = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0
    }

    const modelClient = await this.getOrCreateModelClient()
    const vscodeCancelToken = new vscode.CancellationTokenSource()
    const response = await modelClient.sendRequest(
      vscodeMessages,
      {
        ...params
      },
      vscodeCancelToken.token
    )

    const inputText = vscodeMessages.reduce(
      (acc, msg) => acc + getTextFromVSCodeMessageContents(msg.content),
      ''
    )

    const contentParts: VSCodeAssistantMessageContent[] = []

    // eslint-disable-next-line unused-imports/no-unused-vars
    const { text: _, stream, ...rest } = response
    for await (const chunk of stream as AsyncIterable<VSCodeAssistantMessageContent>) {
      if (options.signal?.aborted) {
        vscodeCancelToken.cancel()
      }

      contentParts.push(chunk)
      const vscodeAIMessage =
        vscode.LanguageModelChatMessage.Assistant(contentParts)
      const outputText = getTextFromVSCodeMessageContents(contentParts)
      const currentText = getTextFromVSCodeMessageContents([chunk])

      usageMetadata.input_tokens = inputText.length
      usageMetadata.output_tokens = outputText.length
      usageMetadata.total_tokens =
        usageMetadata.input_tokens + usageMetadata.output_tokens

      const generationChunk = new ChatGenerationChunk({
        text: currentText,
        message: convertVSCodeOutputChunkMessageToLangChain(
          vscodeAIMessage,
          chunk,
          {
            responseMetadata: rest,
            usageMetadata
          }
        )
      })
      yield generationChunk
      await runManager?.handleLLMNewToken(
        generationChunk.text ?? '',
        undefined,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk }
      )
    }

    // Yield the `response_metadata` as the final chunk.
    yield new ChatGenerationChunk({
      text: '',
      message: new AIMessageChunk({
        content: '',
        response_metadata: rest,
        usage_metadata: usageMetadata
      })
    })
  }

  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema: z.ZodType<RunOutput> | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>

  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema: z.ZodType<RunOutput> | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>

  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema: z.ZodType<RunOutput> | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        {
          raw: BaseMessage
          parsed: RunOutput
        }
      >

  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema: z.ZodType<RunOutput> | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        {
          raw: BaseMessage
          parsed: RunOutput
        }
      > {
    if (config?.method === undefined || config?.method === 'jsonSchema') {
      const outputSchemaIsZod = isZodSchema(outputSchema)
      const jsonSchema = outputSchemaIsZod
        ? zodToJsonSchema(outputSchema)
        : outputSchema
      const llm = this.bind({
        format: jsonSchema
      })
      const outputParser = outputSchemaIsZod
        ? StructuredOutputParser.fromZodSchema(outputSchema)
        : new JsonOutputParser<RunOutput>()

      if (!config?.includeRaw) {
        return llm.pipe(outputParser) as Runnable<
          BaseLanguageModelInput,
          RunOutput
        >
      }

      const parserAssign = RunnablePassthrough.assign({
        parsed: (input: any, config) => outputParser.invoke(input.raw, config)
      })
      const parserNone = RunnablePassthrough.assign({
        parsed: () => null
      })
      const parsedWithFallback = parserAssign.withFallbacks({
        fallbacks: [parserNone]
      })
      return RunnableSequence.from<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      >([
        {
          raw: llm
        },
        parsedWithFallback
      ])
    }
    // TODO: Fix this type in core

    return super.withStructuredOutput<RunOutput>(outputSchema, config as any)
  }
}
