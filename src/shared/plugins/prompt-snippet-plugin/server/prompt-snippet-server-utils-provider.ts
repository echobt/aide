import type { ActionRegister } from '@extension/registers/action-register'
import {
  ConversationEntity,
  type Conversation,
  type LangchainMessageContents,
  type Mention,
  type PromptSnippet
} from '@shared/entities'
import type { ServerUtilsProvider } from '@shared/plugins/base/server/create-provider-manager'
import { removeDuplicates } from '@shared/utils/common'
import { mergeLangchainMessageContents } from '@shared/utils/merge-langchain-message-contents'

import { PromptSnippetMentionType, type PromptSnippetMention } from '../types'

export class PromptSnippetServerUtilsProvider implements ServerUtilsProvider {
  async createRefreshMentionFn(actionRegister: ActionRegister) {
    const snippets = await actionRegister
      .actions()
      .server.promptSnippet.getSnippets({
        actionParams: {}
      })

    const idMapSnippet = new Map<string, PromptSnippet>()

    for (const snippet of snippets) {
      idMapSnippet.set(snippet.id, snippet)
    }

    return (_mention: Mention) => {
      const mention = { ..._mention } as PromptSnippetMention
      switch (mention.type) {
        case PromptSnippetMentionType.PromptSnippet:
          const snippet = idMapSnippet.get(mention.data.id)

          if (snippet) {
            mention.data = snippet
          }
          break

        default:
          break
      }

      return mention
    }
  }

  private getMergedSnippetsInfo(relativeMentions: Mention[]) {
    const result = {
      mentions: [] as Mention[],
      contents: [] as LangchainMessageContents,
      state: new ConversationEntity().entity.state
    }

    if (!relativeMentions?.length) return result

    const mergeState = (sourceState: typeof result.state) => {
      result.state.selectedFilesFromFileSelector.push(
        ...sourceState.selectedFilesFromFileSelector
      )
      result.state.selectedImagesFromOutsideUrl.push(
        ...sourceState.selectedImagesFromOutsideUrl
      )
    }

    const processPromptSnippetMention = (mention: PromptSnippetMention) => {
      // Merge direct contents and state
      result.contents.push(...mention.data.contents)
      mergeState(mention.data.state)

      // Process nested mentions
      mention.data.mentions.forEach(childMention => {
        if (childMention.type === PromptSnippetMentionType.PromptSnippet) {
          const nestedResult = this.getMergedSnippetsInfo([childMention])
          result.mentions.push(...nestedResult.mentions)
          result.contents.push(...nestedResult.contents)
          mergeState(nestedResult.state)
        }
      })
    }

    relativeMentions.forEach(mention => {
      if (mention.type === PromptSnippetMentionType.PromptSnippet) {
        processPromptSnippetMention(mention as PromptSnippetMention)
      }
    })

    return result
  }

  processConversationBeforeCreateMessage(conversation: Conversation) {
    const { mentions, contents, state } = this.getMergedSnippetsInfo(
      conversation.mentions
    )

    return {
      ...conversation,
      mentions: [...mentions, ...conversation.mentions],
      contents: [
        ...mergeLangchainMessageContents(contents),
        ...conversation.contents
      ],
      state: {
        ...state,
        selectedFilesFromFileSelector: removeDuplicates(
          [
            ...state.selectedFilesFromFileSelector,
            ...conversation.state.selectedFilesFromFileSelector
          ],
          ['fullPath']
        ),
        selectedImagesFromOutsideUrl: removeDuplicates(
          [
            ...state.selectedImagesFromOutsideUrl,
            ...conversation.state.selectedImagesFromOutsideUrl
          ],
          ['url']
        )
      }
    }
  }
}
