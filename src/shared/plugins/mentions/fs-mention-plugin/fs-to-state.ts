import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import type { CodebaseSearchAgent } from '@shared/plugins/agents/codebase-search-agent-plugin/server/codebase-search-agent'
import type { ReadFilesAgent } from '@shared/plugins/agents/read-files-agent-plugin/server/read-files-agent'

import { BaseToState } from '../_base/base-to-state'
import { FsMentionType, type FsMention } from './types'

export class FsToState extends BaseToState<FsMention> {
  toMentionsState() {
    return {
      selectedFiles: this.getMentionDataByType(FsMentionType.File),
      selectedFolders: this.getMentionDataByType(FsMentionType.Folder),
      selectedTrees: this.getMentionDataByType(FsMentionType.Tree),
      codeChunks: this.getMentionDataByType(FsMentionType.Code),
      enableCodebaseAgent: this.isMentionExit(FsMentionType.Codebase),
      editorErrors: this.getMentionDataByType(FsMentionType.Errors).flat()
    }
  }

  toAgentsState() {
    return {
      codeSnippets: [
        ...(this.getAgentOutputsByKey<CodebaseSearchAgent, 'codeSnippets'>(
          AgentPluginId.CodebaseSearch,
          'codeSnippets'
        ).flat() || []),
        ...(this.getAgentOutputsByKey<ReadFilesAgent, 'codeSnippets'>(
          AgentPluginId.ReadFiles,
          'codeSnippets'
        ).flat() || [])
      ]
    }
  }
}
