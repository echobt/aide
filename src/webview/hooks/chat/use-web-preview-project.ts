import type { WebPreviewProjectFile } from '@shared/entities'
import { AgentPluginId } from '@shared/plugins/agents/_base/types'
import {
  getLatestWebPreviewProject,
  getWebPreviewProjectVersionsFiles
} from '@shared/utils/chat-context-helper/common/web-preview-project'
import { signalToController } from '@shared/utils/common'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { OpenWebPreviewParams } from '@webview/actions/web-preview'
import { useChatContext } from '@webview/contexts/chat-context'
import { api } from '@webview/network/actions-api'
import { logAndToastError } from '@webview/utils/common'

import { useContextBySessionId } from './use-context-by-session-id'
import { useWebPreviewDefaultProjectVersion } from './use-web-preview-default-project-version'

export interface UseWebPreviewProjectProps {
  sessionId: string
  projectName: string
  projectVersion?: number
  defaultPresetName?: string
  disableFetch?: boolean
}

export const useWebPreviewProject = (props: UseWebPreviewProjectProps) => {
  const {
    sessionId,
    projectName,
    projectVersion,
    defaultPresetName,
    disableFetch = false
  } = props
  const { setContext } = useChatContext()
  const { context, isCurrentSession, finalSessionId } = useContextBySessionId({
    sessionId
  })

  const latestWebPreviewProject = getLatestWebPreviewProject(
    context?.conversations ?? [],
    projectName
  )
  const presetName =
    defaultPresetName ?? latestWebPreviewProject?.presetName ?? ''

  const versionsFiles = getWebPreviewProjectVersionsFiles(
    context?.conversations ?? [],
    projectName
  )
  const { defaultVersion } = useWebPreviewDefaultProjectVersion({
    projectName,
    context
  })

  const currentVersion = projectVersion ?? defaultVersion
  const currentVersionFiles = versionsFiles[currentVersion] || []
  const preVersionFiles = versionsFiles[currentVersion - 1] || []

  const updateFiles = (
    projectName: string,
    projectVersion: number,
    newFiles: WebPreviewProjectFile[]
  ) => {
    if (!isCurrentSession) return

    setContext(draft => {
      let currentVersionIndex = -1
      draft.conversations.forEach(conversation => {
        const webPreviewProject = conversation.actions.find(
          action =>
            action.agent?.name === AgentPluginId.WebPreview &&
            action.agent?.input.name === projectName
        )

        if (webPreviewProject) {
          currentVersionIndex += 1

          if (currentVersionIndex === projectVersion) {
            webPreviewProject.agent!.input.files = newFiles
          }
        }
      })
    })
  }

  const { data: presetInfo } = useQuery({
    queryKey: ['web-preview-preset-info', { presetName }],
    queryFn: ({ signal }) =>
      api.actions().server.webvm.getPresetInfo({
        abortController: signalToController(signal),
        actionParams: { presetName }
      }),
    enabled: Boolean(presetName && !disableFetch)
  })

  const startPreviewMutation = useMutation({
    mutationFn: () =>
      api.actions().server.webvm.startPreviewVMFiles({
        actionParams: {
          projectName,
          sessionId: finalSessionId,
          presetName,
          files: currentVersionFiles
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
        actionParams: {
          projectName,
          sessionId: finalSessionId,
          presetName
        }
      }),
    onSuccess: () => {
      refreshStatus()
    },
    onError: error => {
      logAndToastError('Failed to stop preview VM', error)
    }
  })

  const vmStatusParams = {
    projectName,
    sessionId: finalSessionId,
    presetName
  }

  const { data: _vmStatus, refetch: refreshStatus } = useQuery({
    queryKey: ['web-preview-vm-status', vmStatusParams],
    queryFn: ({ signal }) =>
      api.actions().server.webvm.getVMStatus({
        abortController: signalToController(signal),
        actionParams: vmStatusParams
      }),
    enabled: Boolean(
      projectName && finalSessionId && presetName && !disableFetch
    ),
    refetchInterval: 3000
  })

  const vmStatus = _vmStatus || startPreviewMutation.data?.status

  const openPreviewPage = async (
    params: Omit<OpenWebPreviewParams, 'sessionId' | 'toastMessage'>
  ) => {
    await api.actions().server.webvm.openWebviewForFullScreen({
      actionParams: {
        sessionId: finalSessionId,
        ...params
      }
    })
  }

  return {
    context,
    isCurrentSession,
    presetName,
    presetInfo,
    updateFiles,
    startPreviewMutation,
    stopPreviewMutation,
    vmStatus,
    refreshStatus,
    versionsFiles,
    currentVersion,
    currentVersionFiles,
    preVersionFiles,
    openPreviewPage
  }
}
