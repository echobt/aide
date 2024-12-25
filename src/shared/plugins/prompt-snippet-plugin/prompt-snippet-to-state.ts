import { BaseToState } from '../base/base-to-state'
import { PromptSnippetMentionType, type PromptSnippetMention } from './types'

export class PromptSnippetToState extends BaseToState<PromptSnippetMention> {
  toMentionsState() {
    return {
      snippetIds: this.getMentionDataByType(
        PromptSnippetMentionType.PromptSnippet
      )
    }
  }

  toAgentsState() {
    return {}
  }
}
