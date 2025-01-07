import type { PromptSnippet } from '@shared/entities'

export enum PromptSnippetMentionType {
  PromptSnippet = 'promptSnippet',
  PromptSnippets = 'promptSnippets',
  PromptSnippetSetting = 'promptSnippetSetting'
}

export type PromptSnippetMention = {
  type: PromptSnippetMentionType.PromptSnippet
  data: PromptSnippet
}

export interface PromptSnippetInfo {
  id: string
  contents: string
}
