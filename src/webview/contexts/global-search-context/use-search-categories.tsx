import { ChatBubbleIcon, GearIcon } from '@radix-ui/react-icons'
import { type ChatSession } from '@shared/entities'
import { capitalizeFirstLetter } from '@shared/utils/common'
import type {
  SearchCategory,
  SearchItem
} from '@webview/components/global-search/global-search'
import { useOpenSettingsPage } from '@webview/hooks/api/use-open-settings-page'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useChatContext } from '../chat-context'
import { ChatSessionPreview } from './previews/chat-session-preview'
import { SettingPreview } from './previews/setting-preview'
import type { SearchResult, SearchSettingItem } from './types'

export const useSearchCategories = (
  searchResults: SearchResult[]
): SearchCategory[] => {
  const { switchSession } = useChatContext()
  const navigate = useNavigate()
  const { openSettingsPage } = useOpenSettingsPage()
  const { t } = useTranslation()

  const getChatSessionResults = (results: SearchResult[]) =>
    results
      .filter(result => result.type === 'chatSession')
      .map(result => {
        const chatSession = result.item as ChatSession

        return {
          id: chatSession.id,
          title: chatSession.title,
          breadcrumbs: [
            capitalizeFirstLetter(chatSession.type),
            t('webview.globalSearch.history')
          ],
          icon: <ChatBubbleIcon className="!size-3" />,
          keywords: [chatSession.title],
          renderPreview: () => (
            <ChatSessionPreview sessionId={chatSession.id} />
          ),
          onSelect: () => {
            navigate('/')
            switchSession(chatSession.id)
          }
        } satisfies SearchItem
      })

  const getSettingResults = (results: SearchResult[]) =>
    results
      .filter(result => result.type === 'setting')
      .map(result => {
        if (result.type !== 'setting') return null
        const setting = result.item as SearchSettingItem

        const breadcrumbs = setting.groupLabel
          ? [setting.groupLabel, setting.pageLabel]
          : [setting.pageLabel]

        return {
          id: setting.key,
          title: setting.renderOptions.label,
          description: setting.renderOptions.description,
          breadcrumbs,
          icon: <GearIcon className="!size-3" />,
          keywords: [setting.renderOptions.label],
          renderPreview: () => <SettingPreview setting={setting} />,
          onSelect: () => {
            openSettingsPage({ pageId: setting.pageId })
          }
        } satisfies SearchItem
      })
      .filter(Boolean) as SearchItem[]

  return [
    {
      id: 'chatSessions',
      name: t('webview.globalSearch.chatHistory'),
      items: getChatSessionResults(searchResults)
    },
    {
      id: 'settings',
      name: t('webview.globalSearch.settings'),
      items: getSettingResults(searchResults)
    }
  ]
}
