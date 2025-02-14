import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import { useChatContext } from '@webview/contexts/chat-context'
import { api } from '@webview/network/actions-api'

export interface UseContextBySessionIdProps {
  sessionId?: string | null | undefined
}

export const useContextBySessionId = (props: UseContextBySessionIdProps) => {
  const { sessionId } = props
  const { context } = useChatContext()
  const isCurrentSession = !sessionId ? true : context.id === sessionId
  const finalSessionId = !sessionId ? context.id : sessionId

  const { data: targetContext } = useQuery({
    queryKey: ['chat-session', { sessionId: finalSessionId }],
    queryFn: ({ signal }) =>
      api.actions().server.chatSession.getChatContext({
        abortController: signalToController(signal),
        actionParams: {
          sessionId: finalSessionId
        }
      }),
    enabled: Boolean(finalSessionId && !isCurrentSession)
  })

  const finalContext = isCurrentSession ? context : targetContext

  return {
    context: finalContext,
    isCurrentSession,
    finalSessionId
  }
}
