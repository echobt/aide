import type { BaseDB } from './_base'
import { aiModelDB } from './ai-model-db'
import { aiProviderDB } from './ai-provider-db'
import { chatSessionsDB } from './chat-sessions-db'
import { docSitesDB } from './doc-sites-db'
import { gitProjectDB } from './git-project-db'
import { internalConfigDB } from './internal-config-db'
import { mcpDB } from './mcp-db'
import { projectDB } from './project-db'
import {
  promptSnippetsGlobalDB,
  promptSnippetsWorkspaceDB
} from './prompt-snippets-db'
import { globalSettingsDB, workspaceSettingsDB } from './settings-db'

export const dbList = [
  aiModelDB,
  aiProviderDB,
  chatSessionsDB,
  docSitesDB,
  promptSnippetsGlobalDB,
  promptSnippetsWorkspaceDB,
  globalSettingsDB,
  workspaceSettingsDB,
  gitProjectDB,
  projectDB,
  internalConfigDB,
  mcpDB
] as const satisfies BaseDB<any>[]
