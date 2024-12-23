import { signalToController } from '@shared/utils/common'
import { useQuery } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'

export const useDocSites = () =>
  useQuery({
    queryKey: ['realtime', 'docSites'],
    queryFn: ({ signal }) =>
      api.actions().server.doc.getDocSites({
        actionParams: {},
        abortController: signalToController(signal)
      })
  })
