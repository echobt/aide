import { BaseAgent } from '@extension/chat/strategies/_base/base-agent'
import type { BaseGraphState } from '@extension/chat/strategies/_base/base-state'
import { traverseFileOrFolders } from '@extension/file-utils/traverse-fs'
import { workspaceSchemeHandler } from '@extension/file-utils/vfs/schemes/workspace-scheme'
import { z } from 'zod'

import { listDirAgentName } from './agent-names'

export class ListDirAgent extends BaseAgent<BaseGraphState, {}> {
  static name = listDirAgentName

  name = ListDirAgent.name

  logTitle = 'List Directory'

  description = `List the contents of a directory. The quick tool to use for discovery, before using more targeted tools like semantic search or file reading. Useful to try to understand the file structure before diving deeper into specific files. Can be used to explore the codebase.`

  inputSchema = z.object({
    relativePath: z
      .string()
      .describe(
        'Path to list contents of, relative to the workspace root. Ex: "./" is the root of the workspace'
      ),
    explanation: z
      .string()
      .optional()
      .describe(
        'One sentence explanation as to why this tool is being used, and how it contributes to the goal.'
      )
  })

  outputSchema = z.object({
    items: z.array(
      z.object({
        type: z.enum(['file', 'folder']),
        schemeUri: z.string()
      })
    )
  })

  async execute(input: z.infer<typeof this.inputSchema>) {
    const items = await traverseFileOrFolders({
      type: 'fileOrFolder',
      schemeUris: [
        workspaceSchemeHandler.createSchemeUri({
          relativePath: input.relativePath
        })
      ],
      isGetFileContent: false,
      itemCallback: item => item
    })

    return { items }
  }
}
