import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { AIMessageChunk } from '@langchain/core/messages'
import type { VSCodeLMProvider } from '@shared/entities'
import * as vscode from 'vscode'

import { BaseModelProvider } from './helpers/base'
import {
  ChatVSCode,
  type ChatVSCodeCallOptions
} from './helpers/langchain-vscode'

export class VSCodeLMModelProvider extends BaseModelProvider<
  BaseChatModel<ChatVSCodeCallOptions, AIMessageChunk>
> {
  async createLangChainModel() {
    if (!this.aiModel?.name) {
      throw new Error(
        'Model name is required, Please check your AI model settings'
      )
    }

    const { extraFields } = this.aiProvider as VSCodeLMProvider

    const model = new ChatVSCode({
      model: this.aiModel.name,
      verbose: this.isDev,
      vendor: extraFields.vscodeLmVendor
    })

    return model
  }

  async getSupportModelNames() {
    const models = await vscode.lm.selectChatModels()

    return models.map(model => model.name)
  }
}
