import { CommitIcon, MaskOffIcon, TransformIcon } from '@radix-ui/react-icons'
import {
  createMentionClientPlugin,
  type MentionClientPluginSetupProps
} from '@shared/plugins/mentions/_base/client/create-mention-client-plugin'
import type { UseMentionOptionsReturns } from '@shared/plugins/mentions/_base/client/mention-client-plugin-types'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'
import { useQuery } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'
import { type MentionOption } from '@webview/types/chat'

import { useLocalizedLabel } from '../../_base/client/use-localized-label'
import { GitCommit, GitMentionType } from '../types'

export const GitMentionClientPlugin = createMentionClientPlugin({
  id: MentionPluginId.Git,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('useMentionOptions', () => createUseMentionOptions(props))
  }
})

const createUseMentionOptions =
  (props: MentionClientPluginSetupProps) => (): UseMentionOptionsReturns => {
    const tl = useLocalizedLabel()

    const { data: gitCommits = [] } = useQuery({
      queryKey: ['realtime', 'git-commits'],
      queryFn: () =>
        api.actions().server.git.getHistoryCommits({
          actionParams: {
            maxCount: 50
          }
        })
    })

    const gitCommitsMentionOptions: MentionOption[] = gitCommits.map(
      commit =>
        ({
          id: `${GitMentionType.GitCommit}#${commit.sha}`,
          type: GitMentionType.GitCommit,
          label: commit.message,
          data: commit,
          searchKeywords: [commit.sha, commit.message],
          itemLayoutProps: {
            icon: <CommitIcon className="size-4 mr-1 rotate-90" />,
            label: commit.message,
            details: commit.sha
          }
        }) satisfies MentionOption<GitCommit>
    )

    return [
      {
        id: GitMentionType.Git,
        type: GitMentionType.Git,
        label: tl('shared.plugins.mentions.git.git'),
        topLevelSort: 5,
        searchKeywords: ['git'],
        itemLayoutProps: {
          icon: <TransformIcon className="size-4 mr-1" />,
          label: tl('shared.plugins.mentions.git.git')
        },
        children: [
          {
            id: GitMentionType.GitDiff,
            type: GitMentionType.GitDiff,
            label: tl('shared.plugins.mentions.git.diffWorkingState'),
            data: null, // TODO: add diff of working state
            searchKeywords: ['diff'],
            itemLayoutProps: {
              icon: <MaskOffIcon className="size-4 mr-1" />,
              label: tl('shared.plugins.mentions.git.diffWorkingState')
            }
          },
          {
            id: GitMentionType.GitPR,
            type: GitMentionType.GitPR,
            label: tl('shared.plugins.mentions.git.prDiffWithMainBranch'),
            data: null, // TODO: add diff with main branch
            searchKeywords: ['pull request', 'pr', 'diff'],
            itemLayoutProps: {
              icon: <MaskOffIcon className="size-4 mr-1" />,
              label: tl('shared.plugins.mentions.git.prDiffWithMainBranch')
            }
          },
          ...gitCommitsMentionOptions
        ]
      }
    ]
  }
