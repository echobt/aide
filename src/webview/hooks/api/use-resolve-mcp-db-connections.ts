import { useEffect } from 'react'
import { signalToController } from '@shared/utils/common'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'

export const useResolveMcpDbConnections = () => {
  const queryClient = useQueryClient()
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
      queryClient.invalidateQueries({ queryKey: ['mcpConfigs'] })
    }
  }, [isSuccess])
}
