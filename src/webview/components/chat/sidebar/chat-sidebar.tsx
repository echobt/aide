import React from 'react'
import { PlusIcon, TrashIcon } from '@radix-ui/react-icons'
import { Button } from '@webview/components/ui/button'
import { useChatContext } from '@webview/contexts/chat-context'
import { cn } from '@webview/utils/common'

export const ChatSidebar: React.FC = () => {
  const {
    context,
    chatSessions,
    createAndSwitchToNewSession,
    deleteSession,
    switchSession
  } = useChatContext()

  const chatSessionForRender = [...chatSessions].sort(
    (a, b) => b.updatedAt - a.updatedAt
  )

  const isOnlyOne = chatSessions.length === 1

  return (
    <div className="flex flex-col h-full">
      <Button
        onClick={createAndSwitchToNewSession}
        className="mb-4 flex items-center justify-center"
      >
        <PlusIcon className="mr-2 size-4" />
        New Chat
      </Button>
      <nav className="flex-1 overflow-y-auto">
        {chatSessionForRender.map(chatSession => (
          <div
            key={chatSession.id}
            className={cn(
              'flex items-center justify-between cursor-pointer px-2 py-1 hover:bg-secondary rounded-lg mb-2',
              {
                'bg-secondary': chatSession.id === context.id
              }
            )}
            onClick={() => switchSession(chatSession.id)}
          >
            <span>{chatSession.title}</span>
            {!isOnlyOne && (
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-transparent"
                onClick={e => {
                  e.stopPropagation()
                  deleteSession(chatSession.id)
                }}
              >
                <TrashIcon className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </nav>
    </div>
  )
}
