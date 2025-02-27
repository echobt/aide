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
import { SquareTerminalIcon } from 'lucide-react'

import { useLocalizedLabel } from '../../_base/client/use-localized-label'
import { TerminalInfo, TerminalMentionType } from '../types'
import { MentionTerminalPreview } from './mention-terminal-preview'

export const TerminalMentionClientPlugin = createMentionClientPlugin({
  id: MentionPluginId.Terminal,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('useMentionOptions', () => createUseMentionOptions(props))
  }
})

const createUseMentionOptions =
  (props: MentionClientPluginSetupProps) => (): UseMentionOptionsReturns => {
    const tl = useLocalizedLabel()
    const { data: terminals = [] } = useQuery({
      queryKey: ['realtime', 'terminals'],
      queryFn: () =>
        api.actions().server.terminal.getTerminalsForMention({
          actionParams: {}
        })
    })

    const terminalMentionOptions: MentionOption[] = terminals.map(terminal => ({
      id: `${TerminalMentionType.Terminal}#${terminal.processId}`,
      type: TerminalMentionType.Terminal,
      label: terminal.name,
      data: terminal,
      searchKeywords: [terminal.name],
      itemLayoutProps: {
        icon: <SquareTerminalIcon className="size-4 mr-1" />,
        label: `${terminal.name} - ${terminal.processId}`,
        details:
          terminal.commands[0]?.input ||
          tl('shared.plugins.mentions.terminal.noCommands')
      },
      customRenderPreview: MentionTerminalPreview
    })) satisfies MentionOption<TerminalInfo>[]

    return [
      {
        id: TerminalMentionType.Terminals,
        type: TerminalMentionType.Terminals,
        label: tl('shared.plugins.mentions.terminal.terminals'),
        topLevelSort: terminalMentionOptions.length > 0 ? 6 : -1,
        searchKeywords: ['terminal', 'shell', 'command'],
        itemLayoutProps: {
          icon: <SquareTerminalIcon className="size-4 mr-1" />,
          label: tl('shared.plugins.mentions.terminal.terminals')
        },
        children: terminalMentionOptions
      }
    ]
  }
