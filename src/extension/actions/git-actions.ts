import { gitUtils } from '@extension/file-utils/git'
import { getWorkspaceFolder } from '@extension/utils'
import { ServerActionCollection } from '@shared/actions/server-action-collection'
import type { ActionContext } from '@shared/actions/types'
import type {
  GitCommit,
  GitDiff
} from '@shared/plugins/mentions/git-mention-plugin/types'
import { settledPromiseResults } from '@shared/utils/common'
import { SimpleGit, type RemoteWithRefs, type StatusResult } from 'simple-git'

export class GitActionsCollection extends ServerActionCollection {
  readonly categoryName = 'git'

  private async getGit(): Promise<SimpleGit | undefined> {
    const workspaceFolder = getWorkspaceFolder()
    let git: SimpleGit | undefined
    try {
      git = await gitUtils.createGit(workspaceFolder.uri.fsPath)
    } catch (error) {
      // no git executable path found
    }
    return git
  }

  async getHistoryCommits(
    context: ActionContext<{ maxCount?: number }>
  ): Promise<GitCommit[]> {
    const { actionParams } = context
    const { maxCount = 50 } = actionParams
    const git = await this.getGit()

    if (!git) return []

    const log = await git.log({ maxCount })

    const commits: GitCommit[] = await settledPromiseResults(
      log.all.map(async commit => {
        const diff = await git.diff([`${commit.hash}^`, commit.hash])
        return {
          sha: commit.hash,
          message: commit.message,
          diff: this.parseDiff(diff),
          author: commit.author_name,
          date: commit.date
        }
      })
    )

    return commits
  }

  async getDiffWithRemoteMainBranch(
    context: ActionContext<{ file?: string }>
  ): Promise<GitDiff[]> {
    const { actionParams } = context
    const { file } = actionParams
    const git = await this.getGit()

    if (!git) return []

    const mainBranchName = await this.getMainBranchName()
    let diff: string

    if (file) {
      diff = await git.diff([`origin/${mainBranchName}`, '--', file])
    } else {
      diff = await git.diff([`origin/${mainBranchName}`])
    }

    return this.parseDiff(diff)
  }

  async getDiffWithWorkingState(
    context: ActionContext<{ file?: string }>
  ): Promise<GitDiff[]> {
    const { actionParams } = context
    const { file } = actionParams
    const git = await this.getGit()

    if (!git) return []

    let diff: string

    if (file) {
      diff = await git.diff(['HEAD', '--', file])
    } else {
      diff = await git.diff(['HEAD'])
    }

    return this.parseDiff(diff)
  }

  private parseDiff(diff: string): GitDiff[] {
    const files = diff.split('diff --git')

    const diffs: GitDiff[] = []

    files.slice(1).forEach(file => {
      const [header, ...chunks] = file.split('@@')
      if (!header) return

      const [from, to] = header.match(/a\/(.+) b\/(.+)/)?.slice(1) || ['', '']

      if (!from || !to) return

      diffs.push({
        from,
        to,
        chunks: chunks.map(chunk => {
          const [content, ...lines] = chunk.split('\n')
          return {
            content: `@@ ${content}`,
            lines: lines.filter(line => line.trim() !== '')
          }
        })
      })
    })

    return diffs
  }

  async getCurrentBranch(context: ActionContext<{}>): Promise<string> {
    const git = await this.getGit()

    if (!git) return 'master'

    return await git.revparse(['--abbrev-ref', 'HEAD'])
  }

  async getStatus(
    context: ActionContext<{}>
  ): Promise<StatusResult | undefined> {
    const git = await this.getGit()
    if (!git) return undefined
    return await git.status()
  }

  async getRemotes(context: ActionContext<{}>): Promise<RemoteWithRefs[]> {
    const git = await this.getGit()

    if (!git) return []

    const remotes = await git.getRemotes(true)
    return remotes
  }

  private async getMainBranchName(): Promise<string> {
    const git = await this.getGit()

    if (!git) return 'master'

    const branches = await git.branch()
    const mainBranch = ['main', 'master', 'trunk', 'development'].find(branch =>
      branches.all.includes(branch)
    )

    return mainBranch || 'main'
  }
}
