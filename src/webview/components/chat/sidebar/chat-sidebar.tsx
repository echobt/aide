import React, { useState } from 'react'
import { TrashIcon } from '@radix-ui/react-icons'
import type { ChatSession } from '@shared/entities'
import {
  SidebarItem,
  type SidebarAction
} from '@webview/components/ui/sidebar/sidebar-item'
import { SidebarList } from '@webview/components/ui/sidebar/sidebar-list'
import { useChatContext } from '@webview/contexts/chat-context'

export const ChatSidebar: React.FC = () => {
  const {
    context,
    chatSessions,
    createNewSessionAndSwitch,
    deleteSessionAndSwitch,
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
        label: 'Delete',
        icon: TrashIcon,
        onClick: () => deleteSessionAndSwitch(session.id),
        className: 'text-destructive focus:text-destructive'
      }
    ].filter(Boolean) as SidebarAction[]

  return (
    <SidebarList
      items={chatSessionForRender}
      idField="id"
      title="Chat Sessions"
      itemName="chat"
      searchPlaceholder="Search chats..."
      onSearch={setSearchQuery}
      onCreateItem={createNewSessionAndSwitch}
      onDeleteItems={items => {
        items.forEach(item => deleteSessionAndSwitch(item.id))
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
