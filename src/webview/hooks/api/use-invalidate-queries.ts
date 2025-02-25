import { useQueryClient } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'
import { getWebviewState } from '@webview/utils/common'

export interface InvalidateQueriesProps {
  type: 'all-webview' | 'current-webview'
  queryKeys: string[] | readonly string[]
}

export const useInvalidateQueries = () => {
  const queryClient = useQueryClient()

  const invalidateQueries = async (props: InvalidateQueriesProps) => {
    const { type, queryKeys } = props
    const { webviewId } = getWebviewState()

    queryClient.invalidateQueries({
      queryKey: queryKeys
    })

    if (type === 'all-webview') {
      // exclude current webview
      await api.actions().server.system.invalidAllWebViewQueries({
        webviewId,
        actionParams: {
          queryKeys: queryKeys as string[]
        }
      })
    }
  }

  return { invalidateQueries }
}
