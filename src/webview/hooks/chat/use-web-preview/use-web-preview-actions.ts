import type { OpenWebPreviewParams } from '@webview/actions/web-preview'
import { api } from '@webview/network/actions-api'

export const useWebPreviewActions = (finalSessionId: string) => {
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
    openPreviewPage
  }
}
