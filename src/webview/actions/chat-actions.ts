import { ClientActionCollection } from '@shared/actions/client-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { useChatContext } from '@webview/contexts/chat-context'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { emitter } from './utils/emitter'
import { useOn } from './utils/use-on'

export class ChatActionsCollection extends ClientActionCollection {
  readonly categoryName = 'chat'

  openChatPage(
    context: ActionContext<{
      sessionId?: string
      refreshSessions?: boolean
      toastMessage?: string
    }>
  ) {
    emitter.emit('chat.openChatPage', context)
  }

  refreshChatSessions(context: ActionContext<{}>) {
    emitter.emit('chat.refreshChatSessions', context)
  }
}

export const useChatActions = () => {
  const navigate = useNavigate()
  const { refreshChatSessions } = useChatContext()
  const location = useLocation()
  const { pathname } = location

  useOn('chat.openChatPage', async context => {
    const { toastMessage, sessionId, refreshSessions } = context.actionParams

    if (refreshSessions) {
      await refreshChatSessions()
    }

    if (toastMessage) {
      toast.info(toastMessage)
    }

    navigate(`/?sessionId=${sessionId}`, {
      replace: pathname === '/'
    })
  })

  useOn('chat.refreshChatSessions', async context => {
    await refreshChatSessions()
  })
}
