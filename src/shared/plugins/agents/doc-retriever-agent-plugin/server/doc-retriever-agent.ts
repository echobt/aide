import {
  BaseAgent,
  type GetAgentInput
} from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { DocIndexer } from '@extension/chat/vectordb/doc-indexer'
import { aidePaths } from '@extension/file-utils/paths'
import { docSchemeHandler } from '@extension/file-utils/vfs/schemes/doc-scheme'
import { docSitesDB } from '@extension/lowdb/doc-sites-db'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import { removeDuplicates, settledPromiseResults } from '@shared/utils/common'
import { z } from 'zod'

import type { DocInfo } from '../types'

export class DocRetrieverAgent extends BaseAgent<
  BaseGraphState,
  { allowSearchDocSiteNames: string[] }
> {
  static name = AgentPluginId.DocRetriever

  name = DocRetrieverAgent.name

  description =
    'Search for relevant information in specified documentation sites.'

  inputSchema = async () =>
    z.object({
      queryParts: z
        .array(
          z.object({
            siteName: z
              .enum(
                (await docSitesDB.getAll()).map(site => site.name) as [
                  string,
                  ...string[]
                ]
              )
              .describe('The name of the documentation site to search'),
            keywords: z
              .array(z.string())
              .describe(
                'List of keywords to search for in the specified doc site'
              )
          })
        )
        .describe(
          "The AI should break down the user's query into multiple parts, each targeting a specific doc site with relevant keywords. This allows for a more comprehensive search across multiple documentation sources."
        )
    })

  outputSchema = z.object({
    relevantDocs: z.array(
      z.object({
        content: z.string(),
        path: z.string()
      }) satisfies z.ZodType<DocInfo>
    )
  })

  async execute(input: GetAgentInput<DocRetrieverAgent>) {
    const { allowSearchDocSiteNames } = this.context.createToolOptions
    const docSites = await docSitesDB.getAll()

    const docPromises = input.queryParts.map(async ({ siteName, keywords }) => {
      const docSite = docSites.find(site => site.name === siteName)

      if (!docSite?.isIndexed || !allowSearchDocSiteNames.includes(siteName)) {
        return []
      }

      const docsRootSchemeUri = docSchemeHandler.createSchemeUri({
        siteName: docSite.name,
        relativePath: './'
      })
      const dbPath = await aidePaths.getGlobalPostgresPath()
      const docIndexer = new DocIndexer(docsRootSchemeUri, dbPath)
      await docIndexer.initialize()

      const searchResults = await settledPromiseResults(
        keywords.map(keyword => docIndexer.searchSimilarRow(keyword))
      )

      const searchRows = removeDuplicates(
        searchResults.flatMap(result => result),
        ['schemeUri']
      ).slice(0, 3)

      const docInfoResults = await settledPromiseResults(
        searchRows.map(async row => ({
          content: await docIndexer.getRowFileContent(row),
          path: docSite.url
        }))
      )

      return docInfoResults
    })

    const results = await settledPromiseResults(docPromises)
    return {
      relevantDocs: results.flatMap(result => result)
    }
  }
}
