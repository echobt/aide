import fs from 'fs/promises'
import path from 'path'
import { logger } from '@extension/logger'
import {
  getCanUpdatePkgJson,
  getExtensionUnpackedDir,
  getIsDev
} from '@extension/utils'
import { settledPromiseResults } from '@shared/utils/common'
import { zodToJsonSchema } from 'zod-to-json-schema'

import type { AgentServerPluginRegistry } from './server/agent-server-plugin-registry'

// for update package.json declare ai tools schema
export const generateVSCodeAIToolsDeclareJson = async (
  agentServerPluginRegistry: AgentServerPluginRegistry
) => {
  if (!getCanUpdatePkgJson() || !getIsDev()) return

  if (!agentServerPluginRegistry)
    throw new Error('Agent server plugin registry not found')

  const tools = await settledPromiseResults(
    agentServerPluginRegistry.providerManagers.serverUtils
      .getValues()
      .map(async provider => {
        const { getAgentClass } = provider
        const AgentClass = getAgentClass()
        const agent = new AgentClass({} as any)

        const { name } = agent
        const displayName = agent.name
        const modelDescription = agent.description
        const tags = ['aide']
        const inputSchema =
          typeof agent.inputSchema === 'function'
            ? await agent.inputSchema()
            : agent.inputSchema

        return {
          name,
          displayName,
          modelDescription,
          tags,
          inputSchema: zodToJsonSchema(inputSchema)
        }
      })
  )

  const pkgJSONPath = path.join(getExtensionUnpackedDir(), './package.json')
  const pkgJSON = JSON.parse(await fs.readFile(pkgJSONPath, 'utf-8'))

  pkgJSON.contributes.languageModelTools = tools

  await fs.writeFile(pkgJSONPath, JSON.stringify(pkgJSON, null, 2))
  logger.dev.log('Update package.json declare ai tools success', tools)
}
