import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { vfs } from '@extension/file-utils/vfs'
import { CodebaseWatcherRegister } from '@extension/registers/codebase-watcher-register'
import { mergeCodeSnippets } from '@shared/plugins/_shared/merge-code-snippets'
import type { CodeSnippet } from '@shared/plugins/agents/codebase-search-agent-plugin/types'
import { z } from 'zod'

import { codebaseSearchAgentName } from './agent-names'

export class CodebaseSearchAgent extends BaseAgent<
  BaseGraphState,
  { enableCodebaseAgent: boolean }
> {
  static name = codebaseSearchAgentName

  name = CodebaseSearchAgent.name

  logTitle = 'Search Codebase'

  description = `Find snippets of code from the codebase most relevant to the search query.
This is a semantic search tool, so the query should ask for something semantically matching what is needed.
If it makes sense to only search in particular directories, please specify them in the targetDirectories field.
Unless there is a clear reason to use your own search query, please just reuse the user's exact query with their wording.
Their exact wording/phrasing can often be helpful for the semantic search query. Keeping the same exact question format can also be helpful.`

  inputSchema = z.object({
    query: z
      .string()
      .describe(
        "The search query to find relevant code. You should reuse the user's exact query/most recent message with their wording unless there is a clear reason not to."
      ),
    targetDirectories: z
      .array(z.string())
      .optional()
      .describe('Glob patterns for directories to search over'),
    explanation: z
      .string()
      .optional()
      .describe(
        'One sentence explanation as to why this tool is being used, and how it contributes to the goal.'
      )
  })

  outputSchema = z.object({
    codeSnippets: z.array(
      z.object({
        fileHash: z.string(),
        schemeUri: z.string(),
        startLine: z.number(),
        startCharacter: z.number(),
        endLine: z.number(),
        endCharacter: z.number(),
        code: z.string()
      }) satisfies z.ZodType<CodeSnippet>
    )
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    const { enableCodebaseAgent } = this.context.createToolOptions

    if (!enableCodebaseAgent) {
      return { codeSnippets: [] }
    }

    const indexer = this.context.strategyOptions.registerManager.getRegister(
      CodebaseWatcherRegister
    )?.indexer

    if (!indexer) {
      return { codeSnippets: [] }
    }

    const searchResults = await indexer.searchSimilarRow(input.query)
    // Filter results by target directories if specified
    const filteredResults = input.targetDirectories
      ? searchResults.filter(row =>
          input.targetDirectories?.some(dir =>
            vfs.resolveRelativePathProSync(row.schemeUri).includes(dir)
          )
        )
      : searchResults

    const searchCodeSnippets = filteredResults.slice(0, 8).map(row => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const { embedding, ...others } = row
      return { ...others, code: '' }
    })

    const codeSnippets = await mergeCodeSnippets(searchCodeSnippets, {
      mode: 'expanded'
    })

    return { codeSnippets }
  }
}
