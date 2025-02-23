import { DocMentionServerPlugin } from '@shared/plugins/mentions/doc-mention-plugin/server/doc-mention-server-plugin'
import { FsMentionServerPlugin } from '@shared/plugins/mentions/fs-mention-plugin/server/fs-mention-server-plugin'
import { GitMentionServerPlugin } from '@shared/plugins/mentions/git-mention-plugin/server/git-mention-server-plugin'
import { McpMentionServerPlugin } from '@shared/plugins/mentions/mcp-mention-plugin/server/mcp-mention-server-plugin'
import { PromptSnippetMentionServerPlugin } from '@shared/plugins/mentions/prompt-snippet-mention-plugin/server/prompt-snippet-mention-server-plugin'
import { TerminalMentionServerPlugin } from '@shared/plugins/mentions/terminal-mention-plugin/server/terminal-mention-server-plugin'
import { WebMentionServerPlugin } from '@shared/plugins/mentions/web-mention-plugin/server/web-mention-server-plugin'

import type { MentionServerPlugin } from './mention-server-plugin-context'

export const createMentionServerPlugins = (): MentionServerPlugin[] => {
  const plugins: MentionServerPlugin[] = [
    new FsMentionServerPlugin(),
    new DocMentionServerPlugin(),
    new WebMentionServerPlugin(),
    new GitMentionServerPlugin(),
    new TerminalMentionServerPlugin(),
    new PromptSnippetMentionServerPlugin(),
    new McpMentionServerPlugin()
  ]

  return plugins
}
