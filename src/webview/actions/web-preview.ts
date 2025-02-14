import { ClientActionCollection } from '@shared/actions/client-action-collection'
import type { ActionContext } from '@shared/actions/types'
import { useQueryClient } from '@tanstack/react-query'
import type { WebVMTab } from '@webview/components/webvm/webvm'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { emitter } from './utils/emitter'
import { useOn } from './utils/use-on'

export interface OpenWebPreviewParams {
  sessionId: string
  projectName?: string
  projectVersion?: number
  tab?: WebVMTab
  activeFilePath?: string
  toastMessage?: string
}

export class WebPreviewActionsCollection extends ClientActionCollection {
  readonly categoryName = 'webPreview'

  openWebPreview(context: ActionContext<OpenWebPreviewParams>) {
    emitter.emit('webPreview.openWebPreview', context)
  }

  refreshWebview(context: ActionContext<{}>) {
    emitter.emit('webPreview.refreshWebview', context)
  }

  openWebPreviewSubPage(
    context: ActionContext<{
      tab?: WebVMTab
      activeFilePath?: string
    }>
  ) {
    emitter.emit('webPreview.openPage', context)
  }
}

export const useWebPreviewActions = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { pathname } = location

  useOn('webPreview.openWebPreview', async context => {
    const {
      toastMessage,
      sessionId,
      projectName,
      projectVersion,
      tab,
      activeFilePath
    } = context.actionParams

    if (toastMessage) toast.info(toastMessage)

    const searchParams = new URLSearchParams()
    searchParams.set('sessionId', sessionId)
    projectName && searchParams.set('projectName', projectName)
    projectVersion &&
      searchParams.set('projectVersion', projectVersion.toString())
    tab && searchParams.set('tab', tab)
    activeFilePath && searchParams.set('activeFilePath', activeFilePath)

    if (pathname !== '/web-preview') {
      await navigate(`/web-preview?${searchParams.toString()}`, {
        replace: true
      })
    }

    emitter.emit('webPreview.openWebPreviewSubPage', {
      ...context,
      actionParams: {
        tab,
        activeFilePath,
        projectVersion
      }
    })
  })

  useOn('webPreview.refreshWebview', async context => {
    await queryClient.invalidateQueries({
      queryKey: ['webPreview']
    })
  })
}
