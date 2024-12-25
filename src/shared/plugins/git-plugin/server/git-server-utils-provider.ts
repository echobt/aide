import type { ActionRegister } from '@extension/registers/action-register'
import type { Mention } from '@shared/entities'
import type { ServerUtilsProvider } from '@shared/plugins/base/server/create-provider-manager'

import { GitMentionType } from '../types'

export class GitServerUtilsProvider implements ServerUtilsProvider {
  async createRefreshMentionFn(actionRegister: ActionRegister) {
    const commits = await actionRegister
      .actions()
      .server.git.getHistoryCommits({
        actionParams: {
          maxCount: 50
        }
      })

    // Create a map of commit SHAs for quick lookup
    const commitMap = new Map(commits.map(commit => [commit.sha, commit]))

    return (_mention: Mention) => {
      const mention = { ..._mention } as Mention
      switch (mention.type) {
        case GitMentionType.GitCommit:
          const commit = commitMap.get(mention.data.sha)
          if (commit) mention.data = commit
          break
        case GitMentionType.GitDiff:
          break
        case GitMentionType.GitPR:
          break
        default:
          break
      }

      return mention
    }
  }
}
