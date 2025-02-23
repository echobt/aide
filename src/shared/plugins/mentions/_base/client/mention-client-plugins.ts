import { DocMentionClientPlugin } from '@shared/plugins/mentions/doc-mention-plugin/client/doc-mention-client-plugin'
import { FsMentionClientPlugin } from '@shared/plugins/mentions/fs-mention-plugin/client/fs-mention-client-plugin'
import { GitMentionClientPlugin } from '@shared/plugins/mentions/git-mention-plugin/client/git-mention-client-plugin'
import { McpMentionClientPlugin } from '@shared/plugins/mentions/mcp-mention-plugin/client/mcp-mention-client-plugin'
import { PromptSnippetMentionClientPlugin } from '@shared/plugins/mentions/prompt-snippet-mention-plugin/client/prompt-snippet-mention-client-plugin'
import { TerminalMentionClientPlugin } from '@shared/plugins/mentions/terminal-mention-plugin/client/terminal-mention-client-plugin'
import { WebMentionClientPlugin } from '@shared/plugins/mentions/web-mention-plugin/client/web-mention-client-plugin'

import type { MentionClientPlugin } from './create-mention-client-plugin'

export const createMentionClientPlugins = (): MentionClientPlugin[] => {
  const plugins: MentionClientPlugin[] = [
    FsMentionClientPlugin,
    DocMentionClientPlugin,
    WebMentionClientPlugin,
    GitMentionClientPlugin,
    TerminalMentionClientPlugin,
    PromptSnippetMentionClientPlugin,
    McpMentionClientPlugin
  ]

  return plugins
}
