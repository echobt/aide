import { GearIcon, IdCardIcon } from '@radix-ui/react-icons'
import {
  createMentionClientPlugin,
  type MentionClientPluginSetupProps
} from '@shared/plugins/mentions/_base/client/create-mention-client-plugin'
import type { UseMentionOptionsReturns } from '@shared/plugins/mentions/_base/client/mention-client-plugin-types'
import { MentionPluginId } from '@shared/plugins/mentions/_base/types'
import { pkg } from '@shared/utils/pkg'
import { useQuery } from '@tanstack/react-query'
import { useOpenSettingsPage } from '@webview/hooks/api/use-open-settings-page'
import { api } from '@webview/network/actions-api'
import { type MentionOption } from '@webview/types/chat'

import { useLocalizedLabel } from '../../_base/client/use-localized-label'
import { DocMentionType } from '../types'

export const DocMentionClientPlugin = createMentionClientPlugin({
  id: MentionPluginId.Doc,
  version: pkg.version,

  setup(props) {
    const { registerProvider } = props

    registerProvider('useMentionOptions', () => createUseMentionOptions(props))
  }
})

const createUseMentionOptions =
  (props: MentionClientPluginSetupProps) => (): UseMentionOptionsReturns => {
    const { openSettingsPage } = useOpenSettingsPage()
    const tl = useLocalizedLabel()

    const { data: docSites = [] } = useQuery({
      queryKey: ['realtime', 'docSites'],
      queryFn: () =>
        api.actions().server.doc.getDocSites({
          actionParams: {}
        })
    })

    const docSettingMentionOption: MentionOption = {
      id: DocMentionType.DocSetting,
      type: DocMentionType.DocSetting,
      label: tl('shared.plugins.mentions.doc.docsSetting'),
      disableAddToEditor: true,
      onSelect: () => {
        openSettingsPage({ pageId: 'chatDoc' })
      },
      searchKeywords: ['setting', 'docsetting'],
      itemLayoutProps: {
        icon: <GearIcon className="size-4 mr-1" />,
        label: tl('shared.plugins.mentions.doc.docsSetting'),
        details: ''
      }
    }

    const docMentionOptions: MentionOption<string>[] = docSites.map(
      site =>
        ({
          id: `${DocMentionType.Doc}#${site.id}`,
          type: DocMentionType.Doc,
          label: site.name,
          data: site.name,
          searchKeywords: [site.name, site.url],
          itemLayoutProps: {
            icon: <IdCardIcon className="size-4 mr-1" />,
            label: site.name,
            details: site.url
          }
        }) satisfies MentionOption<string>
    )

    return [
      {
        id: DocMentionType.Docs,
        type: DocMentionType.Docs,
        label: tl('shared.plugins.mentions.doc.docs'),
        topLevelSort: 4,
        searchKeywords: ['docs'],
        itemLayoutProps: {
          icon: <IdCardIcon className="size-4 mr-1" />,
          label: tl('shared.plugins.mentions.doc.docs')
        },
        children: [docSettingMentionOption, ...docMentionOptions]
      }
    ]
  }
