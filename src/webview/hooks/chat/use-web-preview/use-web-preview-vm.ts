import type { WebPreviewProjectFile } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'

interface VMStatusParams {
  projectName: string
  sessionId: string
  presetName: string
}

export const useWebPreviewVM = (
  params: VMStatusParams,
  disableFetch = false
) => {
  const { projectName, sessionId, presetName } = params

  const startPreviewMutation = useMutation({
    mutationFn: (files: WebPreviewProjectFile[]) =>
      api.actions().server.webvm.startPreviewVMFiles({
        actionParams: {
          projectName,
          sessionId,
          presetName,
          files
        }
      }),
    onSuccess: () => {
      refreshStatus()
    },
    onError: error => {
      logAndToastError('Failed to start preview VM files', error)
    }
  })

  const stopPreviewMutation = useMutation({
    mutationFn: () =>
      api.actions().server.webvm.stopPreviewVM({
        actionParams: { projectName, sessionId, presetName }
      }),
    onSuccess: () => {
      refreshStatus()
    },
    onError: error => {
      logAndToastError('Failed to stop preview VM', error)
    }
  })

  const { data: vmStatus, refetch: refreshStatus } = useQuery({
    queryKey: ['web-preview-vm-status', params],
    queryFn: ({ signal }) =>
      api.actions().server.webvm.getVMStatus({
        abortController: signalToController(signal),
        actionParams: params
      }),
    enabled: Boolean(projectName && sessionId && presetName && !disableFetch)
  })

  return {
    startPreviewMutation,
    stopPreviewMutation,
    vmStatus: vmStatus || startPreviewMutation.data?.status,
    refreshStatus
  }
}
