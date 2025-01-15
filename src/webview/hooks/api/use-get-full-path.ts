import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'

export const useGetFullPath = ({
  schemeUri,
  returnNullIfNotExists
}: {
  schemeUri: string
  returnNullIfNotExists?: boolean
}) =>
  useQuery({
    queryKey: ['realtime', 'get-full-path', schemeUri],
    queryFn: ({ signal }) =>
      api.actions().server.file.resolveFullPath({
        actionParams: { schemeUri, returnNullIfNotExists },
        abortController: signalToController(signal)
      }),
    enabled: !!schemeUri
  })
