import { useEffect } from 'react'
import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import { useInvalidateQueries } from '@webview/hooks/api/use-invalidate-queries'
import { api } from '@webview/network/actions-api'

export const useResolveMcpDbConnections = () => {
  const { invalidateQueries } = useInvalidateQueries()
  const { isSuccess } = useQuery({
    queryKey: ['mcp-db-connections'],
    queryFn: ({ signal }) =>
      api.actions().server.mcp.resolveDBMcpConnectPromise({
        abortController: signalToController(signal),
        actionParams: {}
      })
  })

  useEffect(() => {
    if (isSuccess) {
      invalidateQueries({
        type: 'all-webview',
        queryKeys: ['mcpConfigs']
      })
    }
  }, [isSuccess])
}
