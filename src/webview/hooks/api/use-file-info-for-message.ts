import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'

export const useFileInfoForMessage = (params: {
  schemeUri: string | undefined
  startLine?: number | undefined
  endLine?: number | undefined
}) =>
  useQuery({
    queryKey: ['fileInfoForMessage', JSON.stringify(params)],
    queryFn: ({ signal }) =>
      api.actions().server.file.getFileInfoForMessage({
        actionParams: {
          ...params,
          schemeUri: params.schemeUri!
        },
        abortController: signalToController(signal)
      }),
    enabled: Boolean(params.schemeUri)
  })
