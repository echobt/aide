import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'

export const useGetFullPath = ({
  path,
  returnNullIfNotExists
}: {
  path: string
  returnNullIfNotExists?: boolean
}) =>
  useQuery({
    queryKey: ['realtime', 'get-full-path', path],
    queryFn: ({ signal }) =>
      api.actions().server.file.getFullPath({
        actionParams: { path, returnNullIfNotExists },
        abortController: signalToController(signal)
      }),
    enabled: !!path
  })
