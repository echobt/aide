import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'

export const useFileInfoForMessage = (params: {
  relativePath: string | undefined
  startLine?: number | undefined
  endLine?: number | undefined
}) =>
  useQuery({
    queryKey: ['fileInfoForMessage', params],
    queryFn: ({ signal }) =>
      api.actions().server.file.getFileInfoForMessage({
        actionParams: {
          ...params,
          schemeUri: params.relativePath!
        },
        abortController: signalToController(signal)
      }),
    enabled: !!params.relativePath
  })
