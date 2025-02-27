import React, { useState } from 'react'
import { TrashIcon } from '@radix-ui/react-icons'
import type { ChatSession } from '@shared/entities'
import { capitalizeFirstLetter } from '@shared/utils/common'
import {
  SidebarItem,
  type SidebarAction
} from '@webview/components/ui/sidebar/sidebar-item'
import { SidebarList } from '@webview/components/ui/sidebar/sidebar-list'
import { useChatContext } from '@webview/contexts/chat-context'
import { useTranslation } from 'react-i18next'

export const ChatSidebar: React.FC = () => {
  const { t } = useTranslation()
  const {
    context,
    chatSessions,
    createNewSessionAndSwitch,
    deleteSessionsAndSwitch,
    switchSession
  } = useChatContext()

  const [searchQuery, setSearchQuery] = useState('')

  const chatSessionForRender = [...chatSessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter(session =>
      searchQuery
        ? session.title.toLowerCase().includes(searchQuery.toLowerCase())
        : true
    )

  const isOnlyOneSession = chatSessions.length === 1
  const getSessionActions = (session: ChatSession): SidebarAction[] =>
    [
      !isOnlyOneSession && {
        label: t('webview.chatSidebar.delete'),
        icon: TrashIcon,
        onClick: () => deleteSessionsAndSwitch([session.id]),
        className: 'text-destructive focus:text-destructive'
      }
    ].filter(Boolean) as SidebarAction[]

  return (
    <SidebarList
      items={chatSessionForRender}
      idField="id"
      title={capitalizeFirstLetter(context.type)}
      itemName={t('webview.chatSidebar.chat')}
      searchPlaceholder={t('webview.chatSidebar.searchChats')}
      onSearch={setSearchQuery}
      onCreateItem={createNewSessionAndSwitch}
      onDeleteItems={items => {
        deleteSessionsAndSwitch(items.map(item => item.id))
      }}
      renderItem={renderItemProps => (
        <SidebarItem
          {...renderItemProps}
          isActive={renderItemProps.item.id === context.id}
          title={renderItemProps.item.title}
          onClick={() => switchSession(renderItemProps.item.id)}
          actions={getSessionActions(renderItemProps.item)}
        />
      )}
    />
  )
}
