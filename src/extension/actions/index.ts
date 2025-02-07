import type { ServerActionCollection } from '@shared/actions/server-action-collection'

import { AgentActionsCollection } from './agent-actions'
import { AIModelActionsCollection } from './ai-model-actions'
import { AIProviderActionsCollection } from './ai-provider-actions'
import { ApplyActionsCollection } from './apply-actions'
import { ChatActionsCollection } from './chat-actions'
import { ChatSessionActionsCollection } from './chat-session-actions'
import { CodebaseActionsCollection } from './codebase-actions'
import { DocActionsCollection } from './doc-actions'
import { FileActionsCollection } from './file-actions'
import { GitActionsCollection } from './git-actions'
import { GitProjectActionsCollection } from './git-project-actions'
import { MentionActionsCollection } from './mention-actions'
import { ProjectActionsCollection } from './project-actions'
import { PromptSnippetActionsCollection } from './prompt-snippet-actions'
import { SettingsActionsCollection } from './settings-actions'
import { SystemActionsCollection } from './system-actions'
import { TerminalActionsCollection } from './terminal-actions'
import { WorkspaceCheckpointActionsCollection } from './workspace-checkpoint-actions'

export const serverActionCollections = [
  ChatActionsCollection,
  CodebaseActionsCollection,
  FileActionsCollection,
  TerminalActionsCollection,
  GitActionsCollection,
  SystemActionsCollection,
  DocActionsCollection,
  ChatSessionActionsCollection,
  ApplyActionsCollection,
  SettingsActionsCollection,
  AIProviderActionsCollection,
  AIModelActionsCollection,
  MentionActionsCollection,
  AgentActionsCollection,
  PromptSnippetActionsCollection,
  ProjectActionsCollection,
  GitProjectActionsCollection,
  WorkspaceCheckpointActionsCollection
] as const satisfies (typeof ServerActionCollection)[]

export type ServerActionCollections = typeof serverActionCollections
