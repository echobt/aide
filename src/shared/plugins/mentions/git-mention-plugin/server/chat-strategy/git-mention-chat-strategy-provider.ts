import type { BuildPromptMode } from '@extension/chat/strategies/_base'
import type { ChatContext, Conversation } from '@shared/entities'
import type {
  GetAgentState,
  GetMentionState
} from '@shared/plugins/mentions/_base/base-to-state'
import type { MentionChatStrategyProvider } from '@shared/plugins/mentions/_base/server/create-mention-provider-manager'
import { removeDuplicates } from '@shared/utils/common'

import { GitToState } from '../../git-to-state'
import type { GitDiff } from '../../types'

interface ConversationWithStateProps {
  conversation: Conversation
  mentionState: GetMentionState<GitToState>
  agentState: GetAgentState<GitToState>
}

export class GitMentionChatStrategyProvider
  implements MentionChatStrategyProvider
{
  private createConversationWithStateProps(
    conversation: Conversation
  ): ConversationWithStateProps {
    const gitToState = new GitToState(conversation)
    const mentionState = gitToState.toMentionsState()
    const agentState = gitToState.toAgentsState()

    return { conversation, mentionState, agentState }
  }

  async buildContextMessagePrompt(
    mode: BuildPromptMode,
    conversation: Conversation,
    chatContext: ChatContext
  ): Promise<string> {
    const props = this.createConversationWithStateProps(conversation)
    const diffWithMainBranchPrompt =
      this.buildGitDiffWithMainBranchPrompt(props)
    const diffOfWorkingStatePrompt =
      this.buildGitDiffOfWorkingStatePrompt(props)
    const commitPrompt = this.buildGitCommitPrompt(props)

    const prompts = [
      diffWithMainBranchPrompt,
      diffOfWorkingStatePrompt,
      commitPrompt
    ].filter(Boolean)

    return prompts.join('\n\n')
  }

  private buildGitCommitPrompt(props: ConversationWithStateProps): string {
    const { mentionState } = props

    if (!mentionState?.gitCommits.length) return ''

    let gitCommitContent = `
## Git Commits
  `

    removeDuplicates(mentionState.gitCommits, ['sha']).forEach(commit => {
      gitCommitContent += `
Commit: ${commit.sha}
Message: ${commit.message}
Author: ${commit.author}
Date: ${commit.date}
Diffs:
${this.buildGitDiffsPrompt(commit.diff)}
`
    })

    return gitCommitContent
  }

  private buildGitDiffWithMainBranchPrompt(
    props: ConversationWithStateProps
  ): string {
    const { mentionState } = props

    if (!mentionState?.gitDiffWithMain) return ''

    return `
## Git Diff with Main Branch
${this.buildGitDiffsPrompt([mentionState.gitDiffWithMain])}
`
  }

  private buildGitDiffOfWorkingStatePrompt(
    props: ConversationWithStateProps
  ): string {
    const { mentionState } = props

    if (!mentionState?.gitDiffOfWorkingState) return ''

    return `
## Git Diff of Working State
${this.buildGitDiffsPrompt([mentionState.gitDiffOfWorkingState])}
`
  }

  private buildGitDiffsPrompt(gitDiffs: GitDiff[] | undefined): string {
    if (!gitDiffs?.length) return ''

    let gitDiffContent = ''

    gitDiffs.forEach(diff => {
      gitDiffContent += `
File: ${diff.from} → ${diff.to}
Changes:
${diff.chunks
  .map(chunk => chunk.content + chunk.lines.map(line => line).join('\n'))
  .join('\n')}
`
    })

    return gitDiffContent
  }
}
