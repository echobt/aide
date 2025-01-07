import { GlobeIcon } from '@radix-ui/react-icons'
import {
  createMentionClientPlugin,
  type MentionClientPluginSetupProps
} from '@shared/plugins/mentions/_base/client/create-mention-client-plugin'
import type { UseMentionOptionsReturns } from '@shared/plugins/mentions/_base/client/mention-client-plugin-types'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'

import { WebMentionType } from '../types'

export const WebMentionClientPlugin = createMentionClientPlugin({
  id: MentionPluginId.Web,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('useMentionOptions', () => createUseMentionOptions(props))
  }
})

const createUseMentionOptions =
  (props: MentionClientPluginSetupProps) => (): UseMentionOptionsReturns => [
    {
      id: WebMentionType.Web,
      type: WebMentionType.Web,
      label: 'Web',
      data: true,
      topLevelSort: 3,
      searchKeywords: ['web', 'search'],
      itemLayoutProps: {
        icon: <GlobeIcon className="size-4 mr-1" />,
        label: 'Web'
      }
    }
  ]
