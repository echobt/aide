import type { WebPreviewProjectFile } from '@shared/entities'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'
import { useTranslation } from 'react-i18next'

interface VMStatusParams {
  projectName: string
  sessionId: string
  presetName: string | undefined
}

export const useWebPreviewVM = (
  params: VMStatusParams,
  disableFetch = false
) => {
  const { t } = useTranslation()
  const { projectName, sessionId, presetName } = params

  const startPreviewMutation = useMutation({
    mutationFn: (files: WebPreviewProjectFile[]) => {
      if (!presetName) {
        throw new Error(t('webview.webPreview.presetNameRequired'))
      }

      return api.actions().server.webvm.startPreviewVMFiles({
        actionParams: {
          projectName,
          sessionId,
          presetName,
          files
        }
      })
    },
    onSuccess: () => {
      refreshStatus()
    },
    onError: error => {
      logAndToastError(t('webview.webPreview.failedToStartPreview'), error)
    }
  })

  const stopPreviewMutation = useMutation({
    mutationFn: () => {
      if (!presetName) {
        throw new Error(t('webview.webPreview.presetNameRequired'))
      }

      return api.actions().server.webvm.stopPreviewVM({
        actionParams: { projectName, sessionId, presetName }
      })
    },
    onSuccess: () => {
      refreshStatus()
    },
    onError: error => {
      logAndToastError(t('webview.webPreview.failedToStopPreview'), error)
    }
  })

  const { data: vmStatus, refetch: refreshStatus } = useQuery({
    queryKey: ['web-preview-vm-status', params],
    queryFn: ({ signal }) => {
      if (!params.presetName) {
        throw new Error(t('webview.webPreview.presetNameRequired'))
      }

      return api.actions().server.webvm.getVMStatus({
        abortController: signalToController(signal),
        actionParams: params as Omit<VMStatusParams, 'presetName'> & {
          presetName: string
        }
      })
    },
    enabled: Boolean(projectName && sessionId && presetName && !disableFetch)
  })

  return {
    startPreviewMutation,
    stopPreviewMutation,
    vmStatus: vmStatus || startPreviewMutation.data?.status,
    refreshStatus
  }
}
