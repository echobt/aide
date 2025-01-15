import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'

export const useFiles = () =>
  useQuery({
    queryKey: ['realtime', 'files'],
    queryFn: ({ signal }) =>
      api.actions().server.file.traverseWorkspaceFiles({
        actionParams: { schemeUris: ['./'] },
        abortController: signalToController(signal)
      })
  })
