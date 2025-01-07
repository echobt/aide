import { GearIcon, ReaderIcon } from '@radix-ui/react-icons'
import type { PromptSnippet } from '@shared/entities'
import {
  createMentionClientPlugin,
  type MentionClientPluginSetupProps
} from '@shared/plugins/mentions/_base/client/create-mention-client-plugin'
import type { UseMentionOptionsReturns } from '@shared/plugins/mentions/_base/client/mention-client-plugin-types'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { getAllTextFromConversationContents } from '@shared/utils/chat-context-helper/common/get-all-text-from-conversation-contents'
import { pkg } from '@shared/utils/pkg'
import { useQuery } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'
import type { MentionOption } from '@webview/types/chat'
import { useNavigate } from 'react-router'

import { PromptSnippetMentionType } from '../types'
import { MentionPromptSnippetPreview } from './mention-prompt-snippet-preview'

export const PromptSnippetMentionClientPlugin = createMentionClientPlugin({
  id: MentionPluginId.PromptSnippet,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('useMentionOptions', () => createUseMentionOptions(props))
  }
})

const createUseMentionOptions =
  (props: MentionClientPluginSetupProps) => (): UseMentionOptionsReturns => {
    const navigate = useNavigate()
    const { data: snippets = [] } = useQuery({
      queryKey: ['realtime', 'promptSnippets'],
      queryFn: () =>
        api.actions().server.promptSnippet.getSnippets({
          actionParams: {}
        })
    })

    const snippetMentionOptions: MentionOption[] = snippets.map(snippet => {
      const label = snippet.title
      const textContent = getAllTextFromConversationContents(snippet.contents)

      return {
        id: `${PromptSnippetMentionType.PromptSnippet}#${snippet.id}`,
        type: PromptSnippetMentionType.PromptSnippet,
        label,
        data: snippet,
        searchKeywords: [snippet.title, textContent],
        itemLayoutProps: {
          icon: <ReaderIcon className="size-4 mr-1" />,
          label,
          details: textContent
        },
        customRenderPreview: MentionPromptSnippetPreview
      } satisfies MentionOption<PromptSnippet>
    })

    const promptSnippetSettingMentionOption: MentionOption = {
      id: PromptSnippetMentionType.PromptSnippetSetting,
      type: PromptSnippetMentionType.PromptSnippetSetting,
      label: 'Prompt Snippets Setting',
      disableAddToEditor: true,
      onSelect: () => {
        navigate(`/settings?pageId=promptSnippets`)
      },
      searchKeywords: ['setting', 'promptSnippetSetting'],
      itemLayoutProps: {
        icon: <GearIcon className="size-4 mr-1" />,
        label: 'Prompt Snippets Setting',
        details: ''
      }
    }

    return [
      {
        id: PromptSnippetMentionType.PromptSnippets,
        type: PromptSnippetMentionType.PromptSnippets,
        label: 'Prompt Snippets',
        topLevelSort: 100,
        searchKeywords: ['promptsnippets', 'snippets', 'prompt'],
        children: [promptSnippetSettingMentionOption, ...snippetMentionOptions],
        itemLayoutProps: {
          icon: <ReaderIcon className="size-4 mr-1" />,
          label: 'Prompt Snippets'
        }
      }
    ]
  }
